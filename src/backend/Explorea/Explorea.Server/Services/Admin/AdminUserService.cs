using Explorea.API.DTOs.Admin.User;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminUserService : IAdminUserService
    {
        private static readonly string[] ToExcludedRoles =
        [
            RoleNames.SuperAdmin,
            RoleNames.TouristOrganization
        ];

        private readonly IUserRepository _userRepository;
        private readonly IAuthRepository _authRepository;
        private readonly IOrganizationRegionAssignmentRepository _organizationRegionAssignmentRepository;
        private readonly PasswordHelper _passwordHelper;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _db;
        private readonly ILogger<AdminUserService> _logger;

        public AdminUserService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            IOrganizationRegionAssignmentRepository organizationRegionAssignmentRepository,
            PasswordHelper passwordHelper,
            IEmailService emailService,
            IConfiguration configuration,
            AppDbContext db,
            ILogger<AdminUserService> logger)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _organizationRegionAssignmentRepository = organizationRegionAssignmentRepository;
            _passwordHelper = passwordHelper;
            _emailService = emailService;
            _configuration = configuration;
            _db = db;
            _logger = logger;
        }

        public async Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDirectoryAsync(
            AdminUserDirectoryQueryDto query,
            Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var normalizedQuery = NormalizeQuery(query);

            return await _userRepository.GetAdminDirectoryAsync(
                normalizedQuery,
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        public async Task<AdminUserDirectoryStatsDto> GetStatsAsync(Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);

            return await _userRepository.GetAdminDirectoryStatsAsync(
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        public async Task<List<AdminUserDirectoryRegionDto>> GetRegionsAsync(Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);

            return await _userRepository.GetAdminDirectoryRegionsAsync(
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        public async Task<AdminUserDirectoryItemDto> CreateAsync(AdminCreateUserDto dto, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var actor = scope.Actor;

            var normalizedEmail = dto.Email.Trim().ToLower();
            var existing = await _userRepository.GetByEmailAsync(normalizedEmail);
            if (existing != null)
                throw new InvalidOperationException("User with this email already exists.");

            var targetRoleName = dto.Role.Trim().ToLower();
            ValidateCreateRole(actor.Role.Name, targetRoleName);

            var targetRole = await _authRepository.GetRoleByNameAsync(targetRoleName);
            if (targetRole == null)
                throw new InvalidOperationException("Requested role was not found.");

            var managedRegion = await ResolveManagedRegionAsync(dto.Region, scope, required: targetRoleName == RoleNames.TouristOrganization);
            var now = DateTimeOffset.UtcNow;

            var user = new User
            {
                Id = Guid.NewGuid(),
                FirstName = dto.FirstName.Trim(),
                LastName = dto.LastName.Trim(),
                Email = normalizedEmail,
                PasswordHash = _passwordHelper.HashPassword(GenerateTemporaryPassword()),
                RoleId = targetRole.Id,
                Role = targetRole,
                TravelerRank = "explorer",
                TotalVisits = 0,
                MemberSince = now,
                EmailVerifiedAt = now,
                IsActive = NormalizeStatus(dto.Status),
                Gender = NormalizeGender(dto.Gender),
                DateOfBirth = CalculateDateOfBirth(dto.Age),
                ManagedRegionId = managedRegion?.Id,
                ManagedRegion = managedRegion,
                CountryId = IsAdminRole(targetRoleName) ? dto.CountryId : null,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = currentUserId,
                UpdatedBy = currentUserId
            };

            await _userRepository.AddAsync(user);
            await _userRepository.SaveChangesAsync();

            await _authRepository.CreateAuthAccountAsync(new UserAuthAccount
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = "local",
                EmailAtProvider = user.Email,
                IsPrimary = true,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = currentUserId,
                UpdatedBy = currentUserId
            });

            if (user.Role.Name == RoleNames.TouristOrganization && managedRegion != null)
            {
                await _organizationRegionAssignmentRepository.AddAsync(new OrganizationRegionAssignment
                {
                    Id = Guid.NewGuid(),
                    OrganizationUserId = user.Id,
                    RegionId = managedRegion.Id,
                    AssignedAt = now,
                    AssignedBy = currentUserId
                });
                await _organizationRegionAssignmentRepository.SaveChangesAsync();
            }

            var created = await _userRepository.GetByIdWithAdminContextAsync(user.Id)
                ?? throw new InvalidOperationException("Created user could not be loaded.");

            return MapDirectoryItem(created);
        }

        public async Task<AdminUserDirectoryItemDto> UpdateAsync(Guid id, AdminUpdateUserDto dto, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var actor = scope.Actor;

            var user = await _userRepository.GetByIdWithAdminContextAsync(id);
            if (user == null)
                throw new KeyNotFoundException("User was not found.");

            ValidateManageTarget(scope, user);

            var normalizedEmail = dto.Email.Trim().ToLower();
            var existing = await _userRepository.GetByEmailAsync(normalizedEmail);
            if (existing != null && existing.Id != id)
                throw new InvalidOperationException("User with this email already exists.");

            var targetRoleName = dto.Role.Trim().ToLower();
            ValidateUpdateRole(actor.Role.Name, targetRoleName);

            var targetRole = await _authRepository.GetRoleByNameAsync(targetRoleName);
            if (targetRole == null)
                throw new InvalidOperationException("Requested role was not found.");

            var managedRegion = await ResolveManagedRegionAsync(dto.Region, scope, required: targetRoleName == RoleNames.TouristOrganization);
            var now = DateTimeOffset.UtcNow;

            user.FirstName = dto.FirstName.Trim();
            user.LastName = dto.LastName.Trim();
            user.Email = normalizedEmail;
            user.RoleId = targetRole.Id;
            user.Role = targetRole;
            user.IsActive = NormalizeStatus(dto.Status);
            user.Gender = NormalizeGender(dto.Gender);
            user.DateOfBirth = CalculateDateOfBirth(dto.Age);
            user.ManagedRegionId = managedRegion?.Id;
            user.ManagedRegion = managedRegion;
            user.CountryId = IsAdminRole(targetRoleName) ? dto.CountryId : null;
            user.UpdatedAt = now;
            user.UpdatedBy = currentUserId;

            await _userRepository.SaveChangesAsync();

            if (targetRoleName == RoleNames.TouristOrganization)
                await SyncTouristOrganizationRegionAsync(user.Id, targetRoleName, managedRegion, now, currentUserId);

            var updated = await _userRepository.GetByIdWithAdminContextAsync(user.Id)
                ?? throw new InvalidOperationException("Updated user could not be loaded.");

            return MapDirectoryItem(updated);
        }

        public async Task DeleteAsync(Guid id, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var user = await _userRepository.GetByIdWithAdminContextAsync(id);
            if (user == null)
                throw new KeyNotFoundException("User was not found.");

            ValidateManageTarget(scope, user);

            user.DeletedAt = DateTimeOffset.UtcNow;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = currentUserId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            var frontendBase = _configuration["FrontendSettings:BaseUrl"] ?? "";
            var appealLink = $"{frontendBase}/appeal?userId={user.Id}";
            try
            {
                await _emailService.SendAccountDeletedEmailAsync(user.Email, user.FirstName, appealLink);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to send account-deleted email to {Email}; delete itself succeeded.",
                    user.Email);
            }
        }

        public async Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDeletedDirectoryAsync(
            int page, int pageSize, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            if (scope.Actor.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only super admins can view deleted users.");

            return await _userRepository.GetDeletedPagedAsync(page, pageSize);
        }

        public async Task RestoreAsync(Guid id, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            if (scope.Actor.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only super admins can restore deleted users.");

            var user = await _userRepository.GetByIdAsync(id);
            if (user == null || user.DeletedAt == null)
                throw new KeyNotFoundException("Deleted user was not found.");

            await _userRepository.RestoreAsync(id);
        }

        public async Task<AdminUserDirectoryItemDto> SetStatusAsync(Guid id, AdminSetUserStatusDto dto, Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var user = await _userRepository.GetByIdWithAdminContextAsync(id);
            if (user == null)
                throw new KeyNotFoundException("User was not found.");

            ValidateManageTarget(scope, user);

            user.IsActive = NormalizeStatus(dto.Status);
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = currentUserId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            var updated = await _userRepository.GetByIdWithAdminContextAsync(user.Id)
                ?? throw new InvalidOperationException("Updated user could not be loaded.");

            return MapDirectoryItem(updated);
        }

        private async Task<AdminUserScope> ResolveScopeAsync(Guid currentUserId)
        {
            var currentUser = await _userRepository.GetByIdWithRoleAsync(currentUserId);
            if (currentUser == null)
                throw new UnauthorizedAccessException("Current user was not found.");

            if (currentUser.Role.Name == RoleNames.SuperAdmin)
            {
                return new AdminUserScope(
                    Actor: currentUser,
                    VisibleRegionIds: null,
                    IncludeUsersWithoutLocation: true,
                    ExcludedRoles: Array.Empty<string>());
            }

            if (currentUser.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var assignedRegions = await _organizationRegionAssignmentRepository.GetByUserIdAsync(currentUserId);
            var visibleRegionIds = assignedRegions
                .Select(a => a.RegionId)
                .Distinct()
                .ToList();

            // If TO has no assigned regions yet, they should still see users without saved location.
            if (visibleRegionIds.Count == 0)
                visibleRegionIds.Add(-1);

            return new AdminUserScope(
                Actor: currentUser,
                VisibleRegionIds: visibleRegionIds,
                IncludeUsersWithoutLocation: true,
                ExcludedRoles: ToExcludedRoles);
        }

        private static AdminUserDirectoryQueryDto NormalizeQuery(AdminUserDirectoryQueryDto query)
        {
            return new AdminUserDirectoryQueryDto
            {
                Search = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim(),
                Role = NormalizeOptionalFilter(query.Role),
                RegionId = query.RegionId,
                Status = NormalizeOptionalFilter(query.Status),
                ActivityStatus = NormalizeOptionalFilter(query.ActivityStatus),
                Gender = NormalizeOptionalFilter(query.Gender),
                AgeBucket = NormalizeOptionalFilter(query.AgeBucket),
                Page = query.Page < 1 ? 1 : query.Page,
                PageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100)
            };
        }

        private static string? NormalizeOptionalFilter(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var normalized = value.Trim();
            return string.Equals(normalized, "all", StringComparison.OrdinalIgnoreCase)
                ? null
                : normalized;
        }

        private async Task<Region?> ResolveManagedRegionAsync(
            string? regionName,
            AdminUserScope scope,
            bool required)
        {
            if (string.IsNullOrWhiteSpace(regionName))
            {
                if (required)
                    throw new InvalidOperationException("Region is required.");

                return null;
            }

            var region = await _userRepository.GetRegionByNameAsync(regionName);
            if (region == null)
                throw new InvalidOperationException("Selected region was not found.");

            if (scope.Actor.Role.Name == RoleNames.TouristOrganization
                && (scope.VisibleRegionIds == null || !scope.VisibleRegionIds.Contains(region.Id)))
            {
                throw new UnauthorizedAccessException("You cannot assign users outside your region.");
            }

            return region;
        }

        private static void ValidateCreateRole(string actorRoleName, string targetRoleName)
        {
            if (actorRoleName == RoleNames.TouristOrganization
                && (targetRoleName == RoleNames.SuperAdmin || targetRoleName == RoleNames.TouristOrganization))
            {
                throw new UnauthorizedAccessException("Tourist organization cannot create admin roles.");
            }
        }

        private static void ValidateUpdateRole(string actorRoleName, string targetRoleName)
        {
            if (actorRoleName == RoleNames.TouristOrganization
                && (targetRoleName == RoleNames.SuperAdmin || targetRoleName == RoleNames.TouristOrganization))
            {
                throw new UnauthorizedAccessException("Tourist organization cannot assign admin roles.");
            }
        }

        private static void ValidateManageTarget(AdminUserScope scope, User target)
        {
            if (scope.Actor.Role.Name == RoleNames.SuperAdmin)
                return;

            if (target.Role.Name == RoleNames.SuperAdmin || target.Role.Name == RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Tourist organization cannot manage admin users.");

            var hasNoSavedLocation = target.CurrentLatitude == null && target.CurrentLongitude == null;
            if (hasNoSavedLocation && scope.IncludeUsersWithoutLocation)
                return;

            if (scope.VisibleRegionIds == null)
                return;

            var targetRegionId = target.ManagedRegionId ?? target.CurrentCity?.RegionId;
            if (targetRegionId.HasValue && scope.VisibleRegionIds.Contains(targetRegionId.Value))
                return;

            throw new UnauthorizedAccessException("You cannot manage users outside your region.");
        }

        private async Task SyncTouristOrganizationRegionAsync(
            Guid userId,
            string roleName,
            Region? managedRegion,
            DateTimeOffset now,
            Guid currentUserId)
        {
            var existingAssignments = await _organizationRegionAssignmentRepository.GetByUserIdAsync(userId);
            foreach (var assignment in existingAssignments)
            {
                await _organizationRegionAssignmentRepository.RemoveAsync(assignment.Id);
            }

            if (roleName == RoleNames.TouristOrganization && managedRegion != null)
            {
                await _organizationRegionAssignmentRepository.AddAsync(new OrganizationRegionAssignment
                {
                    Id = Guid.NewGuid(),
                    OrganizationUserId = userId,
                    RegionId = managedRegion.Id,
                    AssignedAt = now,
                    AssignedBy = currentUserId
                });
            }

            await _organizationRegionAssignmentRepository.SaveChangesAsync();
        }

        private static AdminUserDirectoryItemDto MapDirectoryItem(User user)
        {
            return new AdminUserDirectoryItemDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                Role = user.Role.Name,
                RegionId = user.ManagedRegionId ?? user.CurrentCity?.RegionId,
                RegionName = user.ManagedRegion?.Name ?? user.CurrentCity?.Region?.Name,
                CountryId = user.CountryId,
                Status = user.IsActive ? "active" : "revoked",
                Gender = string.IsNullOrWhiteSpace(user.Gender) ? "unknown" : user.Gender.ToLower(),
                Age = CalculateAge(user.DateOfBirth),
                Flagged = false,
                LastActivityAt = user.LastLoginAt,
                AvatarUrl = user.ProfileImageUrl
            };
        }

        private static bool NormalizeStatus(string? status)
            => string.Equals(status?.Trim(), "active", StringComparison.OrdinalIgnoreCase);

        private static string? NormalizeGender(string? gender)
            => string.IsNullOrWhiteSpace(gender) ? null : gender.Trim().ToLower();

        private static DateOnly? CalculateDateOfBirth(int? age)
        {
            if (!age.HasValue || age.Value < 0) return null;

            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            return today.AddYears(-age.Value);
        }

        private static int? CalculateAge(DateOnly? dateOfBirth)
        {
            if (dateOfBirth == null)
                return null;

            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var age = today.Year - dateOfBirth.Value.Year;

            if (dateOfBirth.Value > today.AddYears(-age))
                age--;

            return age;
        }

        private static bool IsAdminRole(string roleName)
            => roleName == RoleNames.SuperAdmin || roleName == RoleNames.TouristOrganization;

        private static string GenerateTemporaryPassword()
            => $"{Guid.NewGuid():N}Aa1!";

        private sealed record AdminUserScope(
            User Actor,
            IReadOnlyCollection<int>? VisibleRegionIds,
            bool IncludeUsersWithoutLocation,
            IReadOnlyCollection<string> ExcludedRoles);

        public async Task<AdminUserDetailsDto?> GetUserDetailsAsync(Guid id, Guid currentUserId)
        {
            await ResolveScopeAsync(currentUserId);

            var user = await _db.Users
                .Include(u => u.Role)
                .Include(u => u.CurrentCity).ThenInclude(c => c!.Region)
                .Include(u => u.Country)
                .Include(u => u.ManagedRegion)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return null;

            int? age = null;
            if (user.DateOfBirth.HasValue)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                age = today.Year - user.DateOfBirth.Value.Year;
                if (user.DateOfBirth.Value > today.AddYears(-age.Value)) age--;
            }

            var status = !user.IsActive ? "inactive" : (user.EmailVerifiedAt.HasValue ? "active" : "pending");

            // Selected interests
            var selectedInterests = await _db.UserInterestTags
                .Where(t => t.UserId == id)
                .Select(t => new AdminUserInterestDto
                {
                    Id   = t.InterestTag.Id,
                    Name = t.InterestTag.Name,
                    Icon = t.InterestTag.Icon,
                })
                .ToListAsync();

            // Top scored interests (computed from clicks)
            var topInterests = await _db.UserInterestScores
                .Where(s => s.UserId == id && s.Score > 0)
                .OrderByDescending(s => s.Score)
                .Take(5)
                .Select(s => new AdminUserInterestDto
                {
                    Id    = s.InterestTag.Id,
                    Name  = s.InterestTag.Name,
                    Icon  = s.InterestTag.Icon,
                    Score = s.Score,
                })
                .ToListAsync();

            // Recent clicks (last 5)
            var recentLogs = await _db.PopularityLogs
                .Where(l => l.UserId == id && l.Source == "click")
                .OrderByDescending(l => l.CreatedAt)
                .Take(5)
                .ToListAsync();

            var recentClicks = new List<AdminUserActivityDto>();
            foreach (var log in recentLogs)
            {
                var (name, slug) = await ResolveEntityNameSlugAsync(log.EntityType, log.EntityId);
                recentClicks.Add(new AdminUserActivityDto
                {
                    EntityType = log.EntityType,
                    EntityId   = log.EntityId,
                    EntityName = name,
                    EntitySlug = slug,
                    At         = log.CreatedAt,
                });
            }

            // Saved items
            var savedTotal = await _db.SavedItems.CountAsync(s => s.UserId == id);
            var recentSaves = await _db.SavedItems
                .Where(s => s.UserId == id)
                .OrderByDescending(s => s.SavedAt)
                .Take(6)
                .ToListAsync();

            var savedItems = new List<AdminUserSavedItemDto>();
            foreach (var sv in recentSaves)
            {
                var (name, slug) = await ResolveEntityNameSlugAsync(sv.EntityType, sv.EntityId);
                var preview = await ResolvePreviewImageAsync(sv.EntityType, sv.EntityId);
                savedItems.Add(new AdminUserSavedItemDto
                {
                    EntityType      = sv.EntityType,
                    EntityId        = sv.EntityId,
                    EntityName      = name,
                    EntitySlug      = slug,
                    PreviewImageUrl = preview,
                    SavedAt         = sv.SavedAt,
                });
            }

            // Reviews
            var reviewsTotal = await _db.Reviews.CountAsync(r => r.UserId == id && !r.IsDeleted);
            var recentReviews = await _db.Reviews
                .Where(r => r.UserId == id && !r.IsDeleted)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .ToListAsync();

            var reviews = new List<AdminUserReviewDto>();
            foreach (var r in recentReviews)
            {
                var (name, slug) = await ResolveEntityNameSlugAsync(r.EntityType, r.EntityId);
                reviews.Add(new AdminUserReviewDto
                {
                    Id         = r.Id,
                    EntityType = r.EntityType,
                    EntityId   = r.EntityId,
                    EntityName = name,
                    EntitySlug = slug,
                    Rating     = r.Rating,
                    Comment    = r.Comment,
                    CreatedAt  = r.CreatedAt,
                });
            }

            AdminUserLocationDto? location = null;
            if (user.CurrentLatitude.HasValue || user.CurrentCity != null || user.Country != null)
            {
                location = new AdminUserLocationDto
                {
                    CityName    = user.CurrentCity?.Name,
                    RegionName  = user.CurrentCity?.Region?.Name,
                    CountryName = user.Country?.Name,
                    Latitude    = user.CurrentLatitude,
                    Longitude   = user.CurrentLongitude,
                };
            }

            // Total items added across all trip plans of this user.
            var plannerItemsTotal = await _db.TripPlanItems
                .CountAsync(item => item.TripPlan.UserId == id);

            // === Role-specific: TO / SuperAdmin recent actions ===
            var recentAdminActions = new List<AdminUserAdminActionDto>();
            if (user.Role.Name == RoleNames.TouristOrganization || user.Role.Name == RoleNames.SuperAdmin)
            {
                // Aggregate actions from multiple sources (where this user is the actor).
                var actions = new List<AdminUserAdminActionDto>();

                // Destinations created
                actions.AddRange(await _db.Destinations.IgnoreQueryFilters()
                    .Where(d => d.CreatedBy == id)
                    .OrderByDescending(d => d.CreatedAt)
                    .Take(5)
                    .Select(d => new AdminUserAdminActionDto
                    {
                        Type        = "destination_created",
                        Description = $"Kreirao destinaciju \"{d.Name}\"",
                        At          = d.CreatedAt,
                    }).ToListAsync());

                // Destinations updated (excluding self-create within same second)
                actions.AddRange(await _db.Destinations.IgnoreQueryFilters()
                    .Where(d => d.UpdatedBy == id && (d.CreatedBy != id || d.UpdatedAt > d.CreatedAt.AddSeconds(2)))
                    .OrderByDescending(d => d.UpdatedAt)
                    .Take(5)
                    .Select(d => new AdminUserAdminActionDto
                    {
                        Type        = "destination_updated",
                        Description = $"Izmenio destinaciju \"{d.Name}\"",
                        At          = d.UpdatedAt,
                    }).ToListAsync());

                // Destinations deleted
                actions.AddRange(await _db.Destinations.IgnoreQueryFilters()
                    .Where(d => d.IsDeleted && d.UpdatedBy == id && d.DeletedAt != null)
                    .OrderByDescending(d => d.DeletedAt)
                    .Take(5)
                    .Select(d => new AdminUserAdminActionDto
                    {
                        Type        = "destination_deleted",
                        Description = $"Obrisao destinaciju \"{d.Name}\"",
                        At          = d.DeletedAt!.Value,
                    }).ToListAsync());

                // Places updated/created by this user
                actions.AddRange(await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == id)
                    .OrderByDescending(p => p.CreatedAt)
                    .Take(5)
                    .Select(p => new AdminUserAdminActionDto
                    {
                        Type        = "place_created",
                        Description = $"Kreirao objekat \"{p.Name}\"",
                        At          = p.CreatedAt,
                    }).ToListAsync());

                actions.AddRange(await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.IsDeleted && p.UpdatedBy == id && p.DeletedAt != null)
                    .OrderByDescending(p => p.DeletedAt)
                    .Take(5)
                    .Select(p => new AdminUserAdminActionDto
                    {
                        Type        = "place_deleted",
                        Description = $"Obrisao objekat \"{p.Name}\"",
                        At          = p.DeletedAt!.Value,
                    }).ToListAsync());

                // Events created by this user
                actions.AddRange(await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.CreatedBy == id)
                    .OrderByDescending(e => e.CreatedAt)
                    .Take(5)
                    .Select(e => new AdminUserAdminActionDto
                    {
                        Type        = "event_created",
                        Description = $"Kreirao događaj \"{e.Name}\"",
                        At          = e.CreatedAt,
                    }).ToListAsync());

                actions.AddRange(await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.IsDeleted && e.UpdatedBy == id && e.DeletedAt != null)
                    .OrderByDescending(e => e.DeletedAt)
                    .Take(5)
                    .Select(e => new AdminUserAdminActionDto
                    {
                        Type        = "event_deleted",
                        Description = $"Obrisao događaj \"{e.Name}\"",
                        At          = e.DeletedAt!.Value,
                    }).ToListAsync());

                // Activities created by this user
                actions.AddRange(await _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.CreatedBy == id)
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(5)
                    .Select(a => new AdminUserAdminActionDto
                    {
                        Type        = "activity_created",
                        Description = $"Kreirao aktivnost \"{a.Name}\"",
                        At          = a.CreatedAt,
                    }).ToListAsync());

                // Submission queue items reviewed by this TO (approved/rejected/forwarded)
                actions.AddRange(await _db.SubmissionQueue
                    .Where(q => q.ReviewedByTOUserId == id && q.ReviewedByTOAt != null)
                    .OrderByDescending(q => q.ReviewedByTOAt)
                    .Take(10)
                    .Select(q => new AdminUserAdminActionDto
                    {
                        Type        = "submission_" + q.Status.ToLower(),
                        Description = q.Status == "ApprovedByOwner" || q.Status == "ApprovedByTO"
                            ? $"Odobrio zahtev za {q.EntityType} ({q.EntityId.ToString().Substring(0, 8)})"
                            : q.Status == "RejectedByTO"
                                ? $"Odbio zahtev za {q.EntityType} ({q.EntityId.ToString().Substring(0, 8)})"
                                : $"Obradio zahtev za {q.EntityType} ({q.EntityId.ToString().Substring(0, 8)})",
                        At          = q.ReviewedByTOAt!.Value,
                    }).ToListAsync());

                recentAdminActions = actions
                    .OrderByDescending(a => a.At)
                    .Take(5)
                    .ToList();
            }

            // === Role-specific: place owner entities ===
            var ownedPlaces = new List<AdminUserOwnedEntityDto>();
            var ownedEvents = new List<AdminUserOwnedEntityDto>();
            int ownedPlacesTotal = 0;
            int ownedEventsTotal = 0;
            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                ownedPlacesTotal = await _db.Places.IgnoreQueryFilters()
                    .CountAsync(p => p.CreatedBy == id && !p.IsDeleted);

                ownedPlaces = await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == id && !p.IsDeleted)
                    .OrderByDescending(p => p.CreatedAt)
                    .Take(5)
                    .Select(p => new AdminUserOwnedEntityDto
                    {
                        Id              = p.Id,
                        EntityType      = "place",
                        Name            = p.Name,
                        Slug            = p.Slug,
                        PreviewImageUrl = p.PreviewImageUrl
                            ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                        Status          = p.ApprovalStatus,
                        CreatedAt       = p.CreatedAt,
                    })
                    .ToListAsync();

                ownedEventsTotal = await _db.Events.IgnoreQueryFilters()
                    .CountAsync(e => e.CreatedBy == id && !e.IsDeleted);

                ownedEvents = await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.CreatedBy == id && !e.IsDeleted)
                    .OrderByDescending(e => e.CreatedAt)
                    .Take(5)
                    .Select(e => new AdminUserOwnedEntityDto
                    {
                        Id              = e.Id,
                        EntityType      = "event",
                        Name            = e.Name,
                        Slug            = e.Slug,
                        PreviewImageUrl = e.PreviewImageUrl
                            ?? e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                        Status          = e.Visibility,
                        CreatedAt       = e.CreatedAt,
                    })
                    .ToListAsync();
            }

            return new AdminUserDetailsDto
            {
                Id            = user.Id,
                FirstName     = user.FirstName,
                LastName      = user.LastName,
                Email         = user.Email,
                Role          = user.Role.Name,
                Status        = status,
                TravelerRank  = user.TravelerRank,
                AvatarUrl     = user.ProfileImageUrl,
                Bio           = user.Bio,
                Gender        = user.Gender,
                DateOfBirth   = user.DateOfBirth?.ToDateTime(TimeOnly.MinValue),
                Age           = age,
                MemberSince   = user.MemberSince,
                LastLoginAt   = user.LastLoginAt,
                EmailVerifiedAt = user.EmailVerifiedAt,
                PlannerItemsTotal = plannerItemsTotal,
                Location      = location,
                ManagedRegion = user.ManagedRegion?.Name,
                SelectedInterests = selectedInterests,
                TopInterests  = topInterests,
                RecentClicks  = recentClicks,
                SavedItems    = savedItems,
                SavedItemsTotal = savedTotal,
                Reviews       = reviews,
                ReviewsTotal  = reviewsTotal,
                RecentAdminActions = recentAdminActions,
                OwnedPlaces   = ownedPlaces,
                OwnedPlacesTotal = ownedPlacesTotal,
                OwnedEvents   = ownedEvents,
                OwnedEventsTotal = ownedEventsTotal,
            };
        }

        public async Task<List<AdminUserOwnedEntityDto>> GetUserOwnedEntitiesAsync(Guid userId, string entityType, Guid currentUserId)
        {
            await ResolveScopeAsync(currentUserId);

            return entityType.ToLowerInvariant() switch
            {
                "place" => await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == userId && !p.IsDeleted)
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new AdminUserOwnedEntityDto
                    {
                        Id              = p.Id,
                        EntityType      = "place",
                        Name            = p.Name,
                        Slug            = p.Slug,
                        PreviewImageUrl = p.PreviewImageUrl
                            ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                        Status          = p.ApprovalStatus,
                        CreatedAt       = p.CreatedAt,
                    })
                    .ToListAsync(),
                "event" => await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.CreatedBy == userId && !e.IsDeleted)
                    .OrderByDescending(e => e.CreatedAt)
                    .Select(e => new AdminUserOwnedEntityDto
                    {
                        Id              = e.Id,
                        EntityType      = "event",
                        Name            = e.Name,
                        Slug            = e.Slug,
                        PreviewImageUrl = e.PreviewImageUrl
                            ?? e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                        Status          = e.Visibility,
                        CreatedAt       = e.CreatedAt,
                    })
                    .ToListAsync(),
                _ => new List<AdminUserOwnedEntityDto>(),
            };
        }

        private async Task<(string? name, string? slug)> ResolveEntityNameSlugAsync(string entityType, Guid entityId)
        {
            return entityType.ToLowerInvariant() switch
            {
                "destination" => await _db.Destinations
                    .Where(d => d.Id == entityId)
                    .Select(d => new ValueTuple<string?, string?>(d.Name, d.Slug))
                    .FirstOrDefaultAsync(),
                "place" => await _db.Places
                    .Where(p => p.Id == entityId)
                    .Select(p => new ValueTuple<string?, string?>(p.Name, p.Slug))
                    .FirstOrDefaultAsync(),
                "activity" => await _db.Activities
                    .Where(a => a.Id == entityId)
                    .Select(a => new ValueTuple<string?, string?>(a.Name, a.Slug))
                    .FirstOrDefaultAsync(),
                "event" => await _db.Events
                    .Where(e => e.Id == entityId)
                    .Select(e => new ValueTuple<string?, string?>(e.Name, e.Slug))
                    .FirstOrDefaultAsync(),
                _ => (null, null),
            };
        }

        private async Task<string?> ResolvePreviewImageAsync(string entityType, Guid entityId)
        {
            return entityType.ToLowerInvariant() switch
            {
                "destination" => await _db.Destinations
                    .Where(d => d.Id == entityId)
                    .Select(d => d.PreviewImageUrl ?? d.HeroImageUrl
                        ?? d.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault())
                    .FirstOrDefaultAsync(),
                "place" => await _db.Places
                    .Where(p => p.Id == entityId)
                    .Select(p => p.PreviewImageUrl
                        ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault())
                    .FirstOrDefaultAsync(),
                "activity" => await _db.Activities
                    .Where(a => a.Id == entityId)
                    .Select(a => a.PreviewImageUrl
                        ?? a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault())
                    .FirstOrDefaultAsync(),
                "event" => await _db.Events
                    .Where(e => e.Id == entityId)
                    .Select(e => e.PreviewImageUrl
                        ?? e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault())
                    .FirstOrDefaultAsync(),
                _ => null,
            };
        }
    }
}
