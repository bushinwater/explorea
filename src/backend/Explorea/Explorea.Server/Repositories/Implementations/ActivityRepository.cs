using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Implementations
{
  public class ActivityRepository : BaseRepository<Activity>, IActivityRepository
  {
    public ActivityRepository(AppDbContext db) : base(db) { }

    public async Task<Activity?> GetActivityDetailsBySlugAsync(string slug)
    {
      return await _db.Activities
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.Season)
        .Include(a => a.Inclusions)
        .Include(a => a.Images)
        .FirstOrDefaultAsync(a => a.Slug == slug);
    }

    public async Task<List<Review>> GetActivityReviewsAsync(Guid activityId, int take = 10)
    {
        return await _db.Reviews
            .AsNoTracking()
            .Include(r => r.User)
            .Where(r => r.EntityType == "activity" && r.EntityId == activityId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(take)
            .ToListAsync();    
    }

    public async Task<Activity?> GetBySlugAsync(string slug)
        {
            return await _set
                .Include(a => a.City)
                .Include(a => a.Destination)
                .Include(a => a.Place)
                .Include(a => a.Category)
                .Include(a => a.Season)
                .Include(a => a.Images)
                .Include(a => a.Inclusions)
                .FirstOrDefaultAsync(a => a.Slug == slug);
        }

        public async Task<(List<Activity> Items, int Total)> GetPagedAsync(
            Guid? destinationId, int? categoryId, int? seasonId,
            string? difficulty, int page, int pageSize)
        {
            var query = _set
                .Include(a => a.Category)
                .Include(a => a.Season)
                .Include(a => a.Images)
                .AsQueryable();

            if (destinationId.HasValue)
                query = query.Where(a => a.DestinationId == destinationId);

            if (categoryId.HasValue)
                query = query.Where(a => a.CategoryId == categoryId);

            if (seasonId.HasValue)
                query = query.Where(a => a.SeasonId == seasonId);

            if (!string.IsNullOrEmpty(difficulty))
                query = query.Where(a => a.DifficultyLevel == difficulty);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

    public async Task<List<Activity>> GetSimilarActivitiesAsync(Activity activity, int take = 6)
    {
      return await _db.Activities
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.Images)
        .Where(a => 
            a.Id != activity.Id && 
            a.Slug != activity.Slug && 
            (
                a.CategoryId == activity.CategoryId || 
                (activity.DestinationId != null && a.DestinationId == activity.DestinationId)
            ))
        .OrderByDescending(a => a.IsFeatured)
        .ThenByDescending(a => a.Popularity)
        .ThenByDescending(a => a.AvgRating)
        .ThenBy(a => a.Name)
        .Take(take)
        .ToListAsync();
    }
  }
}