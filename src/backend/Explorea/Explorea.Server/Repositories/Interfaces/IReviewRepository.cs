using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IReviewRepository : IBaseRepository<Review>
    {
        Task<(List<Review> Items, int Total)> GetPagedAsync(
            string entityType, Guid entityId, int page, int pageSize);
        Task DeleteByUserAsync(Guid id, Guid userId);
    }
}