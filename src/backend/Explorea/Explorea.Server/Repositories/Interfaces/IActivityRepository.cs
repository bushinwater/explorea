using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IActivityRepository : IBaseRepository<Activity>
    {
        Task<Activity?> GetBySlugAsync(string slug);
        Task<(List<Activity> Items, int Total)> GetPagedAsync(
            Guid? destinationId, int? categoryId, int? seasonId,
            string? difficulty, int page, int pageSize);
    }
}