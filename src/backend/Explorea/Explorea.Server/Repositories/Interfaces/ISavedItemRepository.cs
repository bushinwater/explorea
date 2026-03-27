using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ISavedItemRepository : IBaseRepository<SavedItem>
    {
        Task<(List<SavedItem> Items, int Total)> GetByUserAsync(
            Guid userId, int page, int pageSize);
        Task DeleteByEntityAsync(Guid userId, string entityType, Guid entityId);
    }
}