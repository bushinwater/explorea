using Explorea.API.DTOs.Admin.User;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

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

        public AdminUserService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            IOrganizationRegionAssignmentRepository organizationRegionAssignmentRepository,
            PasswordHelper passwordHelper)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _organizationRegionAssignmentRepository = organizationRegionAssignmentRepository;
            _passwordHelper = passwordHelper;
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

            var managedRegion = await ResolveManagedRegionAsync(dto.Region, scope, required: targetRoleName != RoleNames.SuperAdmin);
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

            var managedRegion = await ResolveManagedRegionAsync(dto.Region, scope, required: targetRoleName != RoleNames.SuperAdmin);
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
            user.UpdatedAt = now;
            user.UpdatedBy = currentUserId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();
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

            var existingAssignments = await _organizationRegionAssignmentRepository.GetByUserIdAsync(user.Id);
            foreach (var assignment in existingAssignments)
            {
                await _organizationRegionAssignmentRepository.RemoveAsync(assignment.Id);
            }

            _userRepository.Remove(user);
            await _userRepository.SaveChangesAsync();
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

        private static string GenerateTemporaryPassword()
            => $"{Guid.NewGuid():N}Aa1!";

        private sealed record AdminUserScope(
            User Actor,
            IReadOnlyCollection<int>? VisibleRegionIds,
            bool IncludeUsersWithoutLocation,
            IReadOnlyCollection<string> ExcludedRoles);
    }
}
