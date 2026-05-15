using Explorea.API.DTOs.Admin.Activity;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Admin
{
  public class AdminActivityRepository : IAdminActivityRepository
  {
    private readonly AppDbContext _context;

    public AdminActivityRepository(AppDbContext context)
    {
      _context = context;
    }

    public IQueryable<Activity> Query()
    {
      return _context.Activities
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.City)
          .ThenInclude(c => c!.Region)
        .Include(a => a.Destination)
        .Include(a => a.Images);
    }

    public async Task<Activity?> GetByIdAsync(Guid id)
    {
      return await _context.Activities
        .IgnoreQueryFilters()
        .Include(a => a.Category)
        .Include(a => a.City)
          .ThenInclude(c => c!.Region)
        .Include(a => a.Destination)
        .Include(a => a.Images.OrderBy(i => i.SortOrder))
        .Include(a => a.Inclusions)
        .Include(a => a.Season)
        .FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<AdminActivityStatsDto> GetStatsAsync()
    {
      var totalActivities = await _context.Activities
        .IgnoreQueryFilters()
        .CountAsync(a => !a.IsDeleted);

      var mostPopular = await _context.Activities
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(a => !a.IsDeleted)
        .OrderByDescending(a => a.Popularity)
        .Select(a => new { a.Name, a.Popularity })
        .FirstOrDefaultAsync();

      var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);

      var activeIds = await _context.Activities
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(a => !a.IsDeleted)
        .Select(a => a.Id)
        .ToListAsync();

      var visitedIds = await _context.Visits
        .AsNoTracking()
        .Where(v => v.EntityType == "activity" && v.VisitedAt >= thirtyDaysAgo)
        .Select(v => v.EntityId)
        .Distinct()
        .ToListAsync();

      var visitedSet = visitedIds.ToHashSet();
      var inactiveCount = activeIds.Count(id => !visitedSet.Contains(id));

      var newest = await _context.Activities
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(a => !a.IsDeleted)
        .OrderByDescending(a => a.CreatedAt)
        .Select(a => new { a.Name, a.CreatedAt })
        .FirstOrDefaultAsync();

      return new AdminActivityStatsDto
      {
        TotalActivities  = totalActivities,
        MostPopularName  = mostPopular?.Name,
        MostPopularViews = mostPopular?.Popularity ?? 0,
        InactiveCount    = inactiveCount,
        NewestName       = newest?.Name,
        NewestCreatedAt  = newest?.CreatedAt,
      };
    }

    public async Task AddAsync(Activity activity)
    {
      await _context.Activities.AddAsync(activity);
    }

    public void Update(Activity activity)
    {
      _context.Activities.Update(activity);
    }

    public void Delete(Activity activity)
    {
      activity.IsDeleted = true;
      activity.DeletedAt = DateTimeOffset.UtcNow;
      _context.Activities.Update(activity);
    }

    public async Task<int> SaveChangesAsync()
    {
      return await _context.SaveChangesAsync();
    }
  }
}
