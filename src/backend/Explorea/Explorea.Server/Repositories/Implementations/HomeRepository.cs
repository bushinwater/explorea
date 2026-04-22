using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

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
    
    public async Task<List<Destination>> GetFeaturedDestinationsAsync(int take, double? userLat, double? userLng, int? cityId = null)
    {
      var userPoint = BuildUserPoint(userLat, userLng);

      var query = _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .Where(d => cityId == null || d.CityId == cityId)
          .AsQueryable();
      
      query = userPoint != null 
          ? query.OrderBy(d => d.Location.Distance(userPoint))
                 .ThenByDescending(d => d.Popularity)
                 .ThenByDescending(d => d.IsFeatured)
                 .ThenByDescending(d => d.AvgRating)
          : query.OrderByDescending(d => d.Popularity)
                 .ThenByDescending(d => d.IsFeatured)
                 .ThenByDescending(d => d.AvgRating);
          
      return await query.Take(take).ToListAsync();
    }

    public async Task<List<Destination>> GetHeroBannerDestinationAsync(int take, double? userLat, double? userLng)
    {
      var userPoint = BuildUserPoint(userLat, userLng);

      var featuredQuery = _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .Where(d => d.HeroImageUrl != null && d.HeroImageUrl != "")
          .AsQueryable();

      featuredQuery = userPoint != null
          ? featuredQuery.OrderBy(d => d.Location.Distance(userPoint))
                         .ThenByDescending(d => d.IsFeatured)
                         .ThenByDescending(d => d.Popularity)
                         .ThenByDescending(d => d.AvgRating)
          : featuredQuery.OrderByDescending(d => d.IsFeatured)
                         .ThenByDescending(d => d.Popularity)
                         .ThenByDescending(d => d.AvgRating);

      var featured = await featuredQuery
          .Take(take)
          .ToListAsync();

      if (featured.Count >= take)
          return featured;

      var existingIds = featured.Select(x => x.Id).ToHashSet();

      var fallbackQuery = _db.Destinations
          .AsNoTracking()
          .Include(d => d.City)
          .Include(d => d.Country)
          .Where(d => !existingIds.Contains(d.Id))
          .AsQueryable();

      fallbackQuery = userPoint != null
          ? fallbackQuery.OrderBy(d => d.Location.Distance(userPoint))
                         .ThenByDescending(d => d.IsFeatured)
                         .ThenByDescending(d => d.Popularity)
                         .ThenByDescending(d => d.AvgRating)
          : fallbackQuery.OrderByDescending(d => d.IsFeatured)
                         .ThenByDescending(d => d.Popularity)
                         .ThenByDescending(d => d.AvgRating);

      var fallback = await fallbackQuery
          .Take(take - featured.Count)
          .ToListAsync();

      featured.AddRange(fallback);
      return featured;
    }

  public async Task<List<Activity>> GetPopularActivitiesAsync(int take, double? userLat, double? userLng, int? cityId = null)
  {
    var userPoint = BuildUserPoint(userLat, userLng);

    var query = _db.Activities
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.Country)
        .Include(a => a.Images)
        .Where(a => cityId == null || a.CityId == cityId)
        .AsQueryable();

    query = userPoint != null
        ? query.OrderBy(a => a.Location != null ? a.Location.Distance(userPoint) : double.MaxValue)
               .ThenByDescending(a => a.IsFeatured)
               .ThenByDescending(a => a.Popularity)
               .ThenByDescending(a => a.AvgRating)
        : query.OrderByDescending(a => a.IsFeatured)
               .ThenByDescending(a => a.Popularity)
               .ThenByDescending(a => a.AvgRating);

    return await query.Take(take).ToListAsync();
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

  public async Task<List<Event>> GetUpcomingEventsAsync(DateTimeOffset now, int take, double? userLat, double? userLng, int? cityId = null)
  {
    var userPoint = BuildUserPoint(userLat, userLng);

    var query = _db.Events
        .AsNoTracking()
        .Include(e => e.Type)
        .Include(e => e.City)
        .Include(e => e.Country)
        .Include(e => e.Images)
        .Where(e => e.EndDatetime >= now && (cityId == null || e.CityId == cityId))
        .AsQueryable();

    query = userPoint != null
        ? query.OrderBy(e => e.Location != null ? e.Location.Distance(userPoint) : double.MaxValue)
               .ThenByDescending(e => e.IsFeatured)
               .ThenByDescending(e => e.Popularity)
               .ThenBy(e => e.StartDatetime)
        : query.OrderByDescending(e => e.IsFeatured)
               .ThenByDescending(e => e.Popularity)
               .ThenBy(e => e.StartDatetime);

    return await query.Take(take).ToListAsync();
  }
    private static Point? BuildUserPoint(double? lat, double? lng)
    {
      if(!lat.HasValue || !lng.HasValue) return null;

      return new Point(lng.Value, lat.Value) { SRID = 4326 };
    }
  }
}