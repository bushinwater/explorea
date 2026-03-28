using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IUserRepository : IBaseRepository<User>
    {
        Task<User?> GetByEmailAsync(string email);
        Task<UserPreferences?> GetPreferencesAsync(Guid userId);
        Task UpsertPreferencesAsync(UserPreferences preferences);
        Task<List<InterestTag>> GetInterestsAsync(Guid userId);
        Task UpdateInterestsAsync(Guid userId, List<int> interestTagIds);
        Task<(List<User> Items, int Total)> GetPagedAsync(int page, int pageSize);
        Task SetActiveAsync(Guid userId, bool isActive);
    }
}