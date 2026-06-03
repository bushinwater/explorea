using Explorea.API.DTOs.Admin.User;
using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IUserRepository : IBaseRepository<User>
    {
        Task<User?> GetByEmailAsync(string email);
        Task<User?> GetByIdWithRoleAsync(Guid id);
        Task<User?> GetByIdWithAdminContextAsync(Guid id);
        Task<Region?> GetRegionByNameAsync(string name);
        Task<UserPreferences?> GetPreferencesAsync(Guid userId);
        Task UpsertPreferencesAsync(UserPreferences preferences);
        Task<List<InterestTag>> GetInterestsAsync(Guid userId);
        Task UpdateInterestsAsync(Guid userId, List<int> interestTagIds);
        Task<(List<User> Items, int Total)> GetPagedAsync(int page, int pageSize);
        Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetAdminDirectoryAsync(
            AdminUserDirectoryQueryDto query,
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null);
        Task<AdminUserDirectoryStatsDto> GetAdminDirectoryStatsAsync(
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null);
        Task<List<AdminUserDirectoryRegionDto>> GetAdminDirectoryRegionsAsync(
            IReadOnlyCollection<int>? visibleRegionIds = null,
            bool includeUsersWithoutLocation = false,
            IReadOnlyCollection<string>? excludedRoles = null);
        Task SetActiveAsync(Guid userId, bool isActive);
        Task UpdateLocationAsync(Guid userId, double lat, double lng);
        Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDeletedPagedAsync(int page, int pageSize);
        Task RestoreAsync(Guid userId);
    }
}
