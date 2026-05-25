using Explorea.API.DTOs.Admin.User;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class UserRepository : BaseRepository<User>, IUserRepository
    {
        public UserRepository(AppDbContext db) : base(db) { }

        public async Task<User?> GetByEmailAsync(string email)
        {
            return await _set
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        public async Task<User?> GetByIdWithRoleAsync(Guid id)
        {
            return await _set
                .Include(u => u.Role)
                .Include(u => u.ManagedRegion)
                .FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<User?> GetByIdWithAdminContextAsync(Guid id)
        {
            return await _set
                .Include(u => u.Role)
                .Include(u => u.ManagedRegion)
                .Include(u => u.CurrentCity)
                    .ThenInclude(c => c!.Region)
                .FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<Region?> GetRegionByNameAsync(string name)
        {
            var normalized = name.Trim().ToLower();

            return await _db.Regions
                .FirstOrDefaultAsync(r => r.Name.ToLower() == normalized);
        }

        public async Task<UserPreferences?> GetPreferencesAsync(Guid userId)
        {
            return await _db.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public async Task UpsertPreferencesAsync(UserPreferences preferences)
        {
            var existing = await _db.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == preferences.UserId);

            if (existing == null)
                await _db.UserPreferences.AddAsync(preferences);
            else
            {
                existing.Theme = preferences.Theme;
                existing.Language = preferences.Language;
                existing.NotificationsEnabled = preferences.NotificationsEnabled;
            }

            await _db.SaveChangesAsync();
        }

        public async Task<List<InterestTag>> GetInterestsAsync(Guid userId)
        {
            return await _db.UserInterestTags
                .Where(t => t.UserId == userId)
                .Include(t => t.InterestTag)
                .Select(t => t.InterestTag)
                .ToListAsync();
        }

        public async Task UpdateInterestsAsync(Guid userId, List<int> interestTagIds)
        {
            var existing = await _db.UserInterestTags
                .Where(t => t.UserId == userId)
                .ToListAsync();

            _db.UserInterestTags.RemoveRange(existing);

            var newTags = interestTagIds.Select(id => new UserInterestTag
            {
                UserId = userId,
                InterestTagId = id
            });

            await _db.UserInterestTags.AddRangeAsync(newTags);
            await _db.SaveChangesAsync();
        }

        public async Task<(List<User> Items, int Total)> GetPagedAsync(
            int page, int pageSize)
        {
            var query = _set.Include(u => u.Role);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetAdminDirectoryAsync(
            AdminUserDirectoryQueryDto query,
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null)
        {
            var baseQuery = BuildAdminDirectoryQuery(
                visibleRegionIds,
                includeUsersWithoutLocation,
                excludedRoles);

            baseQuery = ApplyAdminDirectoryFilters(baseQuery, query);

            var total = await baseQuery.CountAsync();

            var users = await baseQuery
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync();

            return (users.Select(MapAdminDirectoryItem).ToList(), total);
        }

        public async Task<AdminUserDirectoryStatsDto> GetAdminDirectoryStatsAsync(
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var adultThreshold = today.AddYears(-20);

            var query = BuildAdminDirectoryQuery(
                visibleRegionIds,
                includeUsersWithoutLocation,
                excludedRoles);

            var now = DateTimeOffset.UtcNow;
            var firstOfThisMonth = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
            var firstOfLastMonth = firstOfThisMonth.AddMonths(-1);

            var thisMonthCount = await query.CountAsync(u => u.CreatedAt >= firstOfThisMonth);
            var lastMonthCount = await query.CountAsync(u => u.CreatedAt >= firstOfLastMonth && u.CreatedAt < firstOfThisMonth);

            var growthPercent = lastMonthCount == 0
                ? (thisMonthCount > 0 ? 100m : 0m)
                : Math.Round((decimal)(thisMonthCount - lastMonthCount) / lastMonthCount * 100, 1);

            var birthDates = await query
                .Where(u => u.DateOfBirth != null)
                .Select(u => u.DateOfBirth!.Value)
                .ToListAsync();

            decimal? avgAge = null;
            if (birthDates.Count > 0)
            {
                var todayDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
                var ages = birthDates.Select(dob =>
                {
                    var age = todayDate.Year - dob.Year;
                    if (dob > todayDate.AddYears(-age)) age--;
                    return age;
                });
                avgAge = Math.Round((decimal)ages.Average(), 1);
            }

            return new AdminUserDirectoryStatsDto
            {
                TotalUsers = await query.CountAsync(),
                MaleUsers = await query.CountAsync(u => u.Gender != null && u.Gender.ToLower() == "male"),
                FemaleUsers = await query.CountAsync(u => u.Gender != null && u.Gender.ToLower() == "female"),
                Under20Users = await query.CountAsync(u => u.DateOfBirth != null && u.DateOfBirth > adultThreshold),
                Over20Users = await query.CountAsync(u => u.DateOfBirth != null && u.DateOfBirth <= adultThreshold),
                FlaggedAccounts = 0,
                AverageAge = avgAge,
                RegistrationGrowthPercent = growthPercent
            };
        }

        public async Task<List<AdminUserDirectoryRegionDto>> GetAdminDirectoryRegionsAsync(
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null)
        {
            var query = BuildAdminDirectoryQuery(
                visibleRegionIds,
                includeUsersWithoutLocation,
                excludedRoles);

            return await query
                .Where(u => u.ManagedRegionId != null || (u.CurrentCity != null && u.CurrentCity.Region != null))
                .Select(u => new AdminUserDirectoryRegionDto
                {
                    Id = u.ManagedRegionId ?? u.CurrentCity!.Region!.Id,
                    Name = u.ManagedRegion != null ? u.ManagedRegion.Name : u.CurrentCity!.Region!.Name
                })
                .Distinct()
                .OrderBy(r => r.Name)
                .ToListAsync();
        }

        public async Task SetActiveAsync(Guid userId, bool isActive)
        {
            var user = await _set.FindAsync(userId);
            if (user != null)
            {
                user.IsActive = isActive;
                await _db.SaveChangesAsync();
            }
        }

        public async Task UpdateLocationAsync(Guid userId, double lat, double lng)
        {
            var user = await _set.FindAsync(userId);
            if (user == null) return;

            user.CurrentLatitude = lat;
            user.CurrentLongitude = lng;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
        }

        private IQueryable<User> BuildAdminDirectoryQuery(
            IReadOnlyCollection<int>? visibleRegionIds,
            bool includeUsersWithoutLocation,
            IReadOnlyCollection<string>? excludedRoles)
        {
            var query = _set
                .AsNoTracking()
                .Include(u => u.Role)
                .Include(u => u.ManagedRegion)
                .Include(u => u.CurrentCity)
                    .ThenInclude(c => c!.Region)
                .Where(u => u.DeletedAt == null)
                .AsQueryable();

            if (excludedRoles is { Count: > 0 })
            {
                var normalizedRoles = excludedRoles
                    .Select(r => r.Trim().ToLower())
                    .ToList();

                query = query.Where(u => !normalizedRoles.Contains(u.Role.Name.ToLower()));
            }

            if (visibleRegionIds is { Count: > 0 })
            {
                query = query.Where(u =>
                    ((u.ManagedRegionId != null
                      && visibleRegionIds.Contains(u.ManagedRegionId.Value))
                     || (u.CurrentCity != null
                         && u.CurrentCity.RegionId != null
                         && visibleRegionIds.Contains(u.CurrentCity.RegionId.Value)))
                    || (includeUsersWithoutLocation
                        && u.CurrentLatitude == null
                        && u.CurrentLongitude == null));
            }

            return query;
        }

        private static IQueryable<User> ApplyAdminDirectoryFilters(
            IQueryable<User> query,
            AdminUserDirectoryQueryDto filters)
        {
            if (!string.IsNullOrWhiteSpace(filters.Search))
            {
                var search = filters.Search.Trim().ToLower();
                query = query.Where(u =>
                    (u.FirstName + " " + u.LastName).ToLower().Contains(search)
                    || u.Email.ToLower().Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(filters.Role))
            {
                var role = filters.Role.Trim().ToLower();
                query = query.Where(u => u.Role.Name.ToLower() == role);
            }

            if (filters.RegionId.HasValue)
                query = query.Where(u =>
                    u.ManagedRegionId == filters.RegionId.Value
                    || (u.CurrentCity != null && u.CurrentCity.RegionId == filters.RegionId.Value));

            if (!string.IsNullOrWhiteSpace(filters.Status))
            {
                var status = filters.Status.Trim().ToLower();
                query = status switch
                {
                    "active" => query.Where(u => u.IsActive),
                    "revoked" => query.Where(u => !u.IsActive),
                    _ => query
                };
            }

            if (!string.IsNullOrWhiteSpace(filters.ActivityStatus))
            {
                var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
                query = filters.ActivityStatus.Trim().ToLower() switch
                {
                    "active"   => query.Where(u => u.LastLoginAt != null && u.LastLoginAt >= cutoff),
                    "inactive" => query.Where(u => u.LastLoginAt == null || u.LastLoginAt < cutoff),
                    _          => query
                };
            }

            if (!string.IsNullOrWhiteSpace(filters.Gender))
            {
                var gender = filters.Gender.Trim().ToLower();
                query = query.Where(u => u.Gender != null && u.Gender.ToLower() == gender);
            }

            if (!string.IsNullOrWhiteSpace(filters.AgeBucket))
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
                var adultThreshold = today.AddYears(-20);
                var ageBucket = filters.AgeBucket.Trim().ToLower();

                query = ageBucket switch
                {
                    "under_20" => query.Where(u => u.DateOfBirth != null && u.DateOfBirth > adultThreshold),
                    "over_20" => query.Where(u => u.DateOfBirth != null && u.DateOfBirth <= adultThreshold),
                    _ => query
                };
            }

            return query;
        }

        private static AdminUserDirectoryItemDto MapAdminDirectoryItem(User user)
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
    }
}
