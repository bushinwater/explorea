using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IActivityRepository : IBaseRepository<Activity>
    {
        Task<Activity?> GetBySlugAsync(string slug);
        Task<(List<Activity> Items, int Total)> GetPagedAsync(
            Guid? destinationId, int? categoryId, int? seasonId,
            string? difficulty, int page, int pageSize);

        Task<Activity?> GetActivityDetailsBySlugAsync(string slug);
        Task<List<Activity>> GetSimilarActivitiesAsync(Activity activity, int take = 6);
        Task<List<Review>> GetActivityReviewsAsync(Guid activityId, int take = 10);
    }
}