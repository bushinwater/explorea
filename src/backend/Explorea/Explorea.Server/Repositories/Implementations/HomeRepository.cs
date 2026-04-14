using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
  public record ReviewWithEntityDto(Review Review, string? EntityName, string? EntitySlug);

  public class HomeRepository : IHomeRepository
  {
    private readonly AppDbContext _db;

    public HomeRepository(AppDbContext db)
    {
      _db = db;
    }
    
    public async Task<List<Destination>> GetFeaturedDestinationsAsync(int take)
    {
      return await _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .OrderByDescending(d => d.Popularity)
          .ThenByDescending(d => d.IsFeatured)
          .ThenByDescending(d => d.AvgRating)
          .Take(take)
          .ToListAsync();
    }

    public async Task<List<Destination>> GetHeroBannerDestinationAsync(int take)
    {
      var featured = await _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .Where(d => d.HeroImageUrl != null && d.HeroImageUrl != "")
          .OrderByDescending(d => d.IsFeatured)
          .ThenByDescending(d => d.Popularity)
          .ThenByDescending(d => d.AvgRating)
          .Take(take)
          .ToListAsync();

      if(featured.Count >= take) return featured;

      var existingIds = featured.Select(x => x.Id).ToHashSet();

      var fallback = await _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .Where(d => !existingIds.Contains(d.Id))
          .OrderByDescending(d => d.IsFeatured)
          .ThenByDescending(d => d.Popularity)
          .ThenByDescending(d => d.AvgRating)
          .Take(take - featured.Count)
          .ToListAsync();

      featured.AddRange(fallback);
      return featured;
    }

    public async Task<List<Activity>> GetPopularActivitiesAsync(int take)
    {
      return await _db.Activities
          .AsNoTracking()
          .Include(a => a.Category)
          .Include(a => a.Country)
          .Include(a => a.Images)
          .OrderByDescending(a => a.IsFeatured)
          .ThenByDescending(a => a.Popularity)
          .ThenByDescending(a => a.AvgRating)
          .Take(take)
          .ToListAsync();
    }

    public async Task<List<ReviewWithEntityDto>> GetTravelerReviewsAsync(int take)
    {
      var reviews = await _db.Reviews
          .AsNoTracking()
          .Include(r => r.User)
          .Where(r => r.Comment != null && r.Comment != "")
          .OrderByDescending(r => r.CreatedAt)
          .Take(take)
          .ToListAsync();

      var result = new List<ReviewWithEntityDto>();

      foreach (var r in reviews)
      {
        string? name = null;
        string? slug = null;

        if (r.EntityType == "activity")
        {
          var a = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == r.EntityId);
          name = a?.Name; slug = a?.Slug;
        }
        else if (r.EntityType == "destination")
        {
          var d = await _db.Destinations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == r.EntityId);
          name = d?.Name; slug = d?.Slug;
        }
        else if (r.EntityType == "place")
        {
          var p = await _db.Places.AsNoTracking().FirstOrDefaultAsync(x => x.Id == r.EntityId);
          name = p?.Name; slug = p?.Slug;
        }
        else if (r.EntityType == "event")
        {
          var e = await _db.Events.AsNoTracking().FirstOrDefaultAsync(x => x.Id == r.EntityId);
          name = e?.Name; slug = e?.Slug;
        }

        result.Add(new ReviewWithEntityDto(r, name, slug));
      }

      return result;
    }

    public async Task<List<Event>> GetUpcomingEventsAsync(DateTimeOffset now, int take)
    {
      return await _db.Events
          .AsNoTracking()
          .Include(e => e.Type)
          .Include(e => e.City)
          .Include(e => e.Country)
          .Include(e => e.Images)
          .Where(e => e.EndDatetime >= now)
          .OrderByDescending(e => e.IsFeatured)
          .ThenByDescending(e => e.Popularity)
          .ThenBy(e => e.StartDatetime)
          .Take(take)
          .ToListAsync();
    }
  }
}