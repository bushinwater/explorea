using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Search;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Repositories.Implementations
{
  public class SearchPageRepository : ISearchPageRepository
  {
    private readonly AppDbContext _db;

    public SearchPageRepository(AppDbContext db)  
    {
      _db = db;    
    }

    public async Task<List<ActivityCardDto>> GetPopularActivitiesAsync(SearchPageAllQueryDto query, int take)
    {
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);

      var activitiesQuery = _db.Activities
          .AsNoTracking()
          .Include(a => a.Category)
          .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
        var q = query.Query.Trim().ToLower();
        activitiesQuery = activitiesQuery.Where(a =>
            a.Name.ToLower().Contains(q) ||
            (a.Description != null && a.Description.ToLower().Contains(q)) ||
            (a.StartPoint != null && a.StartPoint.ToLower().Contains(q)));
      }

      if (query.CityIds != null && query.CityIds.Count > 0)
      {
        activitiesQuery = activitiesQuery.Where(a => a.CityId != null && query.CityIds.Contains(a.CityId.Value));
      }

      if (query.MinRating.HasValue)
      {
        activitiesQuery = activitiesQuery.Where(a => a.AvgRating >= query.MinRating.Value);
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
        var radiusMeters = query.RadiusKm.Value * 1000;
        activitiesQuery = activitiesQuery.Where(a => a.Location != null && a.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      var items = await activitiesQuery
          .OrderByDescending(a => a.IsFeatured)
          .ThenByDescending(a => a.Popularity)
          .ThenByDescending(a => a.AvgRating)
          .Take(take)
          .Select(a => new ActivityCardDto
          {
              Id = a.Id,
              Name = a.Name,
              Slug = a.Slug,
              Category = a.Category == null
                  ? null
                  : new CategoryRefDto
                  {
                      Id = a.Category.Id,
                      Name = a.Category.Name
                  },
              AvgRating = a.AvgRating,
              DurationMinutes = a.DurationMinutes,
              Price = a.Price,
              DifficultyLevel = a.DifficultyLevel,
              PreviewImageUrl = a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
              Popularity = a.Popularity,
              DistanceKm = userPoint != null && a.Location != null
                ? Math.Round(a.Location.Distance(userPoint) / 1000.0, 2)
                : null,
              Country = null
          })
          .ToListAsync();
            
      return items;
    }

    public async Task<List<DestinationCardDto>> GetPopularDestinationsAsync(SearchPageAllQueryDto query, int take)
    {
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);

      var destinationsQuery = _db.Destinations
        .AsNoTracking()
        .Include(d => d.City)
        .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
        var q = query.Query.Trim().ToLower();
        destinationsQuery = destinationsQuery.Where(d =>
          d.Name.ToLower().Contains(q) ||
          (d.Description != null && d.Description.ToLower().Contains(q)) ||
          (d.City != null && d.City.Name.ToLower().Contains(q))
        );
      }

      if (query.CityIds != null && query.CityIds.Count > 0)
      {
        destinationsQuery = destinationsQuery.Where(d => d.CityId != null && query.CityIds.Contains(d.CityId.Value));
      }

      if (query.MinRating.HasValue)
      {
        destinationsQuery = destinationsQuery.Where(d => d.AvgRating >= query.MinRating.Value);
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
        var radiusMeters = query.RadiusKm.Value * 1000;
        destinationsQuery = destinationsQuery.Where(d => d.Location != null && d.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      var items = await destinationsQuery
          .OrderByDescending(d => d.IsFeatured)
          .ThenByDescending(d => d.Popularity)
          .ThenByDescending(d => d.AvgRating)
          .Take(take)
          .Select(d => new DestinationCardDto
          {
            Id = d.Id,
            Name = d.Name,
            Slug = d.Slug,
            PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
            AvgRating = d.AvgRating,
            City = d.City == null ? null : new CityRefDto
            {
              Id = d.City.Id,
              Name = d.City.Name
            },
            Location = d.Latitude.HasValue && d.Longitude.HasValue ? new LocationDto
            {
              Lat = d.Latitude.Value,
              Lng = d.Longitude.Value
            }
            : null,
            HeroImageUrl = d.HeroImageUrl,
            Popularity = d.Popularity,
            Country = null
          })
          .ToListAsync();

        return items;
    }

    public async Task<List<EventCardDto>> GetNearbyEventsAsync(SearchPageAllQueryDto query, int take)
    {
      var now = DateTimeOffset.UtcNow;
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);

      var eventsQuery = _db.Events
          .AsNoTracking()
          .Include(e => e.City)
          .Include(e => e.Type)
          .Where(e => e.EndDatetime >= now)
          .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
          var q = query.Query.Trim().ToLower();
          eventsQuery = eventsQuery.Where(e =>
              e.Name.ToLower().Contains(q) ||
              (e.Description != null && e.Description.ToLower().Contains(q)) ||
              (e.Address != null && e.Address.ToLower().Contains(q)) ||
              (e.City != null && e.City.Name.ToLower().Contains(q)));
      }

      if (query.CityIds != null && query.CityIds.Count > 0)
      {
          eventsQuery = eventsQuery.Where(e => e.CityId != null && query.CityIds.Contains(e.CityId.Value));
      }
      
      if (query.MinRating.HasValue)
      {
          eventsQuery = eventsQuery.Where(e => e.AvgRating >= query.MinRating.Value);
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
        var radiusMeters = query.RadiusKm.Value * 1000;
        eventsQuery = eventsQuery.Where(e => e.Location != null && e.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      eventsQuery = userPoint != null
        ? eventsQuery.OrderBy(e => e.Location != null ? e.Location.Distance(userPoint) : double.MaxValue)
                     .ThenBy(e => e.StartDatetime)
        : eventsQuery.OrderBy(e => e.StartDatetime)
                     .ThenByDescending(e => e.IsFeatured)
                     .ThenByDescending(e => e.Popularity);
      
      var items = await eventsQuery
          .Take(take)
          .Select(e => new EventCardDto
          {
              Id = e.Id,
              Name = e.Name,
              Slug = e.Slug,
              Type = e.Type == null
                  ? null
                  : new TypeRefDto
                  {
                    Id = e.Type.Id,
                    Name = e.Type.Name
                  },
              StartDatetime = e.StartDatetime,
              EndDatetime = e.EndDatetime,
              Price = e.Price,
              Address = e.Address,
              City = e.City == null
                  ? null
                  : new CityRefDto
                  {
                    Id = e.City.Id,
                    Name = e.City.Name
                  },
              PreviewImageUrl = e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
              IsFeatured = e.IsFeatured,
              Popularity = e.Popularity,
              DistanceKm = userPoint != null && e.Location != null
                ? Math.Round(e.Location.Distance(userPoint) / 1000.0, 2)
                : null,
              Country = null
          })
          .ToListAsync();

      return items;
    }

    public async Task<List<PlaceCardDto>> GetTopRatedPlacesAsync(SearchPageAllQueryDto query, int take)
    {
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);
      var currentDay = GetCurrentDayOfWeekNumber();
      var currentTime = GetCurrentUtcTimeOnly();
      
      var placesQuery = _db.Places
        .AsNoTracking()
        .Include(p => p.City)
        .Include(p => p.Type)
        .Include(p => p.WorkingDays)
          .ThenInclude(wd => wd.Intervals)
        .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
        var q = query.Query.Trim().ToLower();
        placesQuery = placesQuery.Where(p =>
          p.Name.ToLower().Contains(q) ||
          (p.Description != null && p.Description.ToLower().Contains(q)) ||
          (p.Address != null && p.Address.ToLower().Contains(q)) ||
          (p.City != null && p.City.Name.ToLower().Contains(q)) 
        );
      }

      if(query.CityIds != null && query.CityIds.Count > 0)
      {
        placesQuery = placesQuery.Where(p => p.CityId != null && query.CityIds.Contains(p.CityId.Value));
      }
      
      if(query.MinRating.HasValue)
      {
        placesQuery = placesQuery.Where(p => p.AvgRating >= query.MinRating.Value);
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
        var radiusMeters = query.RadiusKm.Value * 1000;
        placesQuery = placesQuery.Where(p => p.Location != null && p.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      var items = await placesQuery
        .OrderByDescending(p => p.AvgRating)
        .ThenByDescending(p => p.IsFeatured)
        .ThenByDescending(p => p.Popularity)
        .Take(take)
        .Select(p => new PlaceCardDto
        {
          Id = p.Id,
          Name = p.Name,
          Slug = p.Slug,
          Type = p.Type == null ? null : new TypeRefDto
          {
            Id = p.Type.Id,
            Name = p.Type.Name
          },
          AvgRating = p.AvgRating,
          Address = p.Address,
          DistanceKm = userPoint != null && p.Location != null
          ? Math.Round(p.Location.Distance(userPoint) / 1000.0, 2)
          : null,
          PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
          IsOpen = p.WorkingDays.Any(wd =>
            wd.DayOfWeek == currentDay &&
            !wd.IsClosed &&
            wd.Intervals.Any(i => i.OpensAt <= currentTime && i.ClosesAt > currentTime)
          ),
          PriceRange = p.PriceRange
        })
        .ToListAsync();
      return items;
    }

    public async Task<(List<ActivityCardDto> Items, int Total)> SearchActivitiesAsync(SearchPageListQueryDto query)
    {
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);
      
      var activitiesQuery = _db.Activities
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.City)
        .Include(a => a.Destination)
        .Where(a => !a.IsDeleted)
        .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
          var q = query.Query.Trim().ToLower();
          if (q.Length >= 4)
              activitiesQuery = activitiesQuery.Where(a =>
                  a.Name.ToLower().Contains(q) ||
                  (a.Description != null && a.Description.ToLower().Contains(q)) ||
                  (a.StartPoint != null && a.StartPoint.ToLower().Contains(q)) ||
                  (a.City != null && a.City.Name.ToLower().Contains(q)));
          else
              activitiesQuery = activitiesQuery.Where(a =>
                  a.Name.ToLower().Contains(q) ||
                  (a.City != null && a.City.Name.ToLower().Contains(q)));
      }

      if (query.RegionsIds?.Count > 0)
      {
          activitiesQuery = activitiesQuery.Where(a =>
              a.City != null &&
              a.City.RegionId != null &&
              query.RegionsIds.Contains(a.City.RegionId.Value));
      }

      if (query.CityIds?.Count > 0)
      {
          activitiesQuery = activitiesQuery.Where(a =>
              a.CityId != null &&
              query.CityIds.Contains(a.CityId.Value));
      }

      if (query.DestinationsIds?.Count > 0)
      {
          activitiesQuery = activitiesQuery.Where(a =>
              a.DestinationId != null &&
              query.DestinationsIds.Contains(a.DestinationId.Value));
      }

      if (query.ActivityCategoryIds?.Count > 0)
      {
          activitiesQuery = activitiesQuery.Where(a => query.ActivityCategoryIds.Contains(a.CategoryId));
      }

      if (query.MinRating.HasValue)
      {
          activitiesQuery = activitiesQuery.Where(a => a.AvgRating >= query.MinRating.Value);
      }

      if (query.MinPrice.HasValue)
      {
          activitiesQuery = activitiesQuery.Where(a => a.Price == null || a.Price >= query.MinPrice.Value);
      }

      if (query.MaxPrice.HasValue)
      {
          activitiesQuery = activitiesQuery.Where(a => a.Price == null || a.Price <= query.MaxPrice.Value);
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
          var radiusMeters = query.RadiusKm.Value * 1000;
          activitiesQuery = activitiesQuery.Where(a => a.Location != null && a.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      activitiesQuery = query.SortBy?.ToLowerInvariant() switch
      {
          "popularity_asc" => activitiesQuery
              .OrderByDescending(a => a.Popularity)
              .ThenByDescending(a => a.AvgRating),

          "popularity_desc" => activitiesQuery
              .OrderBy(a => a.Popularity)
              .ThenBy(a => a.AvgRating),

          "rating_asc" => activitiesQuery
              .OrderByDescending(a => a.AvgRating)
              .ThenByDescending(a => a.Popularity),

          "rating_desc" => activitiesQuery
              .OrderBy(a => a.AvgRating)
              .ThenByDescending(a => a.Popularity),

          "nearest_asc" when userPoint != null => activitiesQuery
              .OrderBy(a => a.Location != null ? a.Location.Distance(userPoint) : double.MaxValue)
              .ThenByDescending(a => a.Popularity),

          "nearest_desc" when userPoint != null => activitiesQuery
              .OrderByDescending(a => a.Location != null ? a.Location.Distance(userPoint) : 0.0)
              .ThenByDescending(a => a.Popularity),

          "duration_asc" => activitiesQuery
              .OrderBy(a => a.DurationMinutes ?? int.MaxValue)
              .ThenByDescending(a => a.Popularity),

          "duration_desc" => activitiesQuery
              .OrderByDescending(a => a.DurationMinutes ?? 0)
              .ThenByDescending(a => a.Popularity),

          "price_asc" => activitiesQuery
              .OrderBy(a => a.Price ?? decimal.MaxValue)
              .ThenByDescending(a => a.Popularity),

          "price_desc" => activitiesQuery
              .OrderByDescending(a => a.Price ?? decimal.MinValue)
              .ThenByDescending(a => a.Popularity),

          _ => activitiesQuery
              .OrderByDescending(a => a.IsFeatured)
              .ThenByDescending(a => a.Popularity)
              .ThenByDescending(a => a.AvgRating)
      };

      var total = await activitiesQuery.CountAsync();

      var items = await ApplyPaging(activitiesQuery, query.Page, query.PageSize)
          .Select(a => new ActivityCardDto
          {
              Id = a.Id,
              Name = a.Name,
              Slug = a.Slug,
              Category = a.Category == null ? null : new CategoryRefDto
              {
                  Id = a.Category.Id,
                  Name = a.Category.Name
              },
              AvgRating = a.AvgRating,
              DurationMinutes = a.DurationMinutes,
              Price = a.Price,
              DifficultyLevel = a.DifficultyLevel,
              PreviewImageUrl = a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
              Popularity = a.Popularity,
              Latitude  = a.Latitude  ?? (a.Destination != null ? a.Destination.Latitude  : null),
              Longitude = a.Longitude ?? (a.Destination != null ? a.Destination.Longitude : null),
              DistanceKm = userPoint != null
                ? (a.Location != null
                    ? Math.Round(a.Location.Distance(userPoint) / 1000.0, 2)
                    : (a.Destination != null && a.Destination.Location != null
                        ? Math.Round(a.Destination.Location.Distance(userPoint) / 1000.0, 2)
                        : null))
                : null,
              Country = null
          })
          .ToListAsync();

      return (items, total);
    }

    public async Task<(List<DestinationCardDto> Items, int Total)> SearchDestinationsAsync(SearchPageListQueryDto query)
    {
      var destinationsQuery = _db.Destinations
        .AsNoTracking()
        .Include(d => d.City)
        .Include(d => d.Type)
        .Where(d => !d.IsDeleted)
        .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
        var q = query.Query.Trim().ToLower();
        if (q.Length >= 4)
            destinationsQuery = destinationsQuery.Where(d =>
                d.Name.ToLower().Contains(q) ||
                (d.Description != null && d.Description.ToLower().Contains(q)) ||
                (d.City != null && d.City.Name.ToLower().Contains(q)));
        else
            destinationsQuery = destinationsQuery.Where(d =>
                d.Name.ToLower().Contains(q) ||
                (d.City != null && d.City.Name.ToLower().Contains(q)));
      }

      if (query.RegionsIds?.Count > 0)
      {
        destinationsQuery = destinationsQuery.Where(d =>
            d.City != null &&
            d.City.RegionId != null &&
            query.RegionsIds.Contains(d.City.RegionId.Value));
      }

      if (query.CityIds?.Count > 0)
      {
        destinationsQuery = destinationsQuery.Where(d =>
            d.CityId != null &&
            query.CityIds.Contains(d.CityId.Value));
      }

      if (query.DestinationTypeIds?.Count > 0)
      {
        destinationsQuery = destinationsQuery.Where(d =>
            d.TypeId != null && query.DestinationTypeIds.Contains(d.TypeId.Value));
      }

      if (query.MinRating.HasValue)
      {
        destinationsQuery = destinationsQuery.Where(d => d.AvgRating >= query.MinRating.Value);
      }

      var extraFiltersDict = ParseExtraFilters(query.ExtraFilters);
      foreach (var (key, value) in extraFiltersDict)
      {
        var snippet = $"{{\"{key}\": {value.ToLower()}}}";
        destinationsQuery = destinationsQuery.Where(d =>
            d.ExtraFilters != null && EF.Functions.JsonContains(d.ExtraFilters, snippet));
      }

      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);

      if (query.RadiusKm.HasValue && userPoint != null)
      {
          var radiusMeters = query.RadiusKm.Value * 1000;
          destinationsQuery = destinationsQuery.Where(d => d.Location != null && d.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      destinationsQuery = query.SortBy?.ToLowerInvariant() switch
      {
        "popularity_asc" => destinationsQuery
            .OrderByDescending(d => d.Popularity)
            .ThenByDescending(d => d.AvgRating),

        "popularity_desc" => destinationsQuery
            .OrderBy(d => d.Popularity)
            .ThenBy(d => d.AvgRating),

        "rating_asc" => destinationsQuery
            .OrderByDescending(d => d.AvgRating)
            .ThenByDescending(d => d.Popularity),

        "rating_desc" => destinationsQuery
            .OrderBy(d => d.AvgRating)
            .ThenByDescending(d => d.Popularity),

        "nearest_asc" when userPoint != null => destinationsQuery
            .OrderBy(d => d.Location != null ? d.Location.Distance(userPoint) : double.MaxValue)
            .ThenByDescending(d => d.Popularity),

        "nearest_desc" when userPoint != null => destinationsQuery
            .OrderByDescending(d => d.Location != null ? d.Location.Distance(userPoint) : 0.0)
            .ThenByDescending(d => d.Popularity),

        "alphabetical_asc" => destinationsQuery
            .OrderBy(d => d.Name),

        "alphabetical_desc" => destinationsQuery
            .OrderByDescending(d => d.Name),

        _ => destinationsQuery
            .OrderByDescending(d => d.IsFeatured)
            .ThenByDescending(d => d.Popularity)
            .ThenByDescending(d => d.AvgRating)
      };

      var total = await destinationsQuery.CountAsync();

      var items = await ApplyPaging(destinationsQuery, query.Page, query.PageSize)
        .Select(d => new DestinationCardDto
        {
            Id = d.Id,
            Name = d.Name,
            Slug = d.Slug,
            PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
            HeroImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
            AvgRating = d.AvgRating,
            Popularity = d.Popularity,
            City = d.City == null ? null : new CityRefDto
            {
                Id = d.City.Id,
                Name = d.City.Name
            },
            Location = d.Latitude.HasValue && d.Longitude.HasValue
                ? new LocationDto
                {
                    Lat = d.Latitude.Value,
                    Lng = d.Longitude.Value
                }
                : null,
            DistanceKm = userPoint != null && d.Location != null
                ? Math.Round(d.Location.Distance(userPoint) / 1000.0, 2)
                : null,
            Country = null,
            TypeName = d.Type != null ? d.Type.Name : null
        })
        .ToListAsync();

      return (items, total);
    }
    public async Task<(List<EventCardDto> Items, int Total)> SearchEventsAsync(SearchPageListQueryDto query)
    {
      var now = DateTimeOffset.UtcNow;
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);

      var eventsQuery = _db.Events
        .AsNoTracking()
        .Include(e => e.City)
        .Include(e => e.Type)
        .Include(e => e.Destination)
        .Where(e => !e.IsDeleted && e.EndDatetime >= now)
        .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
        var q = query.Query.Trim().ToLower();
        if (q.Length >= 4)
            eventsQuery = eventsQuery.Where(e =>
                e.Name.ToLower().Contains(q) ||
                (e.Description != null && e.Description.ToLower().Contains(q)) ||
                (e.Address != null && e.Address.ToLower().Contains(q)) ||
                (e.City != null && e.City.Name.ToLower().Contains(q)));
        else
            eventsQuery = eventsQuery.Where(e =>
                e.Name.ToLower().Contains(q) ||
                (e.City != null && e.City.Name.ToLower().Contains(q)));
      }

      if (query.RegionsIds?.Count > 0)
      {
        eventsQuery = eventsQuery.Where(e =>
            e.City != null &&
            e.City.RegionId != null &&
            query.RegionsIds.Contains(e.City.RegionId.Value));
      }

      if (query.CityIds?.Count > 0)
      {
        eventsQuery = eventsQuery.Where(e =>
            e.CityId != null &&
            query.CityIds.Contains(e.CityId.Value));
      }

      if (query.DestinationsIds?.Count > 0)
      {
        eventsQuery = eventsQuery.Where(e =>
            e.DestinationId != null &&
            query.DestinationsIds.Contains(e.DestinationId.Value));
      }

      if (query.EventTypeIds?.Count > 0)
      {
        eventsQuery = eventsQuery.Where(e => query.EventTypeIds.Contains(e.TypeId));
      }

      if (query.MinPrice.HasValue)
      {
        eventsQuery = eventsQuery.Where(e => e.Price == null || e.Price >= query.MinPrice.Value);
      } 

      if (query.MaxPrice.HasValue)
      {
        eventsQuery = eventsQuery.Where(e => e.Price == null || e.Price <= query.MaxPrice.Value);
      }

      if (query.MinRating.HasValue)
      {
        eventsQuery = eventsQuery.Where(e => e.AvgRating >= query.MinRating.Value);
      }

      var extraFiltersDict = ParseExtraFilters(query.ExtraFilters);
      foreach (var (key, value) in extraFiltersDict)
      {
        var snippet = $"{{\"{key}\": {value.ToLower()}}}";
        eventsQuery = eventsQuery.Where(e =>
            e.ExtraFilters != null && EF.Functions.JsonContains(e.ExtraFilters, snippet));
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
          var radiusMeters = query.RadiusKm.Value * 1000;
          eventsQuery = eventsQuery.Where(e => e.Location != null && e.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      eventsQuery = query.SortBy?.ToLowerInvariant() switch
      {
        "soonest_asc" => eventsQuery
            .OrderBy(e => e.StartDatetime)
            .ThenByDescending(e => e.Popularity),

        "soonest_desc" => eventsQuery
            .OrderByDescending(e => e.StartDatetime)
            .ThenByDescending(e => e.Popularity),

        "popularity_asc" => eventsQuery
            .OrderByDescending(e => e.Popularity)
            .ThenBy(e => e.StartDatetime),

        "popularity_desc" => eventsQuery
            .OrderBy(e => e.Popularity)
            .ThenBy(e => e.StartDatetime),

        "nearest_asc" when userPoint != null => eventsQuery
            .OrderBy(e => e.Location != null ? e.Location.Distance(userPoint) : double.MaxValue)
            .ThenBy(e => e.StartDatetime),

        "nearest_desc" when userPoint != null => eventsQuery
            .OrderByDescending(e => e.Location != null ? e.Location.Distance(userPoint) : 0.0)
            .ThenBy(e => e.StartDatetime),

        "price_asc" => eventsQuery
            .OrderBy(e => e.Price ?? decimal.MaxValue)
            .ThenBy(e => e.StartDatetime),

        "price_desc" => eventsQuery
            .OrderByDescending(e => e.Price ?? decimal.MinValue)
            .ThenBy(e => e.StartDatetime),

        _ => eventsQuery
            .OrderBy(e => e.StartDatetime)
            .ThenByDescending(e => e.IsFeatured)
            .ThenByDescending(e => e.Popularity)
      };

      var total = await eventsQuery.CountAsync();

      var items = await ApplyPaging(eventsQuery, query.Page, query.PageSize)
        .Select(e => new EventCardDto
        {
            Id = e.Id,
            Name = e.Name,
            Slug = e.Slug,
            Type = e.Type == null ? null : new TypeRefDto
            {
                Id = e.Type.Id,
                Name = e.Type.Name
            },
            StartDatetime = e.StartDatetime,
            EndDatetime = e.EndDatetime,
            Price = e.Price,
            Address = e.Address,
            City = e.City == null ? null : new CityRefDto
            {
                Id = e.City.Id,
                Name = e.City.Name
            },
            PreviewImageUrl = e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
            IsFeatured = e.IsFeatured,
            Popularity = e.Popularity,
            Latitude  = e.Latitude  ?? (e.Destination != null ? e.Destination.Latitude  : null),
            Longitude = e.Longitude ?? (e.Destination != null ? e.Destination.Longitude : null),
            DistanceKm = userPoint != null
              ? (e.Location != null
                  ? Math.Round(e.Location.Distance(userPoint) / 1000.0, 2)
                  : (e.Destination != null && e.Destination.Location != null
                      ? Math.Round(e.Destination.Location.Distance(userPoint) / 1000.0, 2)
                      : null))
              : null,
            Country = null
        })
        .ToListAsync();

      return (items, total);
    }

    public async Task<(List<PlaceCardDto> Items, int Total)> SearchPlacesAsync(SearchPageListQueryDto query)
    {
      var userPoint = BuildUserPoint(query.UserLat, query.UserLng);
      var currentDay = GetCurrentDayOfWeekNumber();
      var currentTime = GetCurrentUtcTimeOnly();

      var placesQuery = _db.Places
          .AsNoTracking()
          .Include(p => p.City)
          .Include(p => p.Type)
          .Include(p => p.WorkingDays)
              .ThenInclude(wd => wd.Intervals)
          .Where(p => !p.IsDeleted)
          .AsQueryable();

      if (!string.IsNullOrWhiteSpace(query.Query))
      {
          var q = query.Query.Trim().ToLower();
          if (q.Length >= 4)
              placesQuery = placesQuery.Where(p =>
                  p.Name.ToLower().Contains(q) ||
                  (p.Description != null && p.Description.ToLower().Contains(q)) ||
                  (p.Address != null && p.Address.ToLower().Contains(q)) ||
                  (p.City != null && p.City.Name.ToLower().Contains(q)));
          else
              placesQuery = placesQuery.Where(p =>
                  p.Name.ToLower().Contains(q) ||
                  (p.City != null && p.City.Name.ToLower().Contains(q)));
      }

      if (query.RegionsIds?.Count > 0)
      {
          placesQuery = placesQuery.Where(p =>
              p.City != null &&
              p.City.RegionId != null &&
              query.RegionsIds.Contains(p.City.RegionId.Value));
      }

      if (query.CityIds?.Count > 0)
      {
          placesQuery = placesQuery.Where(p =>
              p.CityId != null &&
              query.CityIds.Contains(p.CityId.Value));
      }

      if (query.DestinationsIds?.Count > 0)
      {
          placesQuery = placesQuery.Where(p =>
              p.DestinationId != null &&
              query.DestinationsIds.Contains(p.DestinationId.Value));
      }

      if (query.MinRating.HasValue)
      {
          placesQuery = placesQuery.Where(p => p.AvgRating >= query.MinRating.Value);
      }

      if (query.PlaceTypeIds?.Count > 0)
      {
          placesQuery = placesQuery.Where(p =>
              p.TypeId != null &&
              query.PlaceTypeIds.Contains(p.TypeId.Value));
      }

      if (query.OpenNow == true)
      {
        placesQuery = placesQuery.Where(p =>
            p.WorkingDays.Any(wd =>
                wd.DayOfWeek == currentDay &&
                !wd.IsClosed &&
                wd.Intervals.Any(i => i.OpensAt <= currentTime && i.ClosesAt >= currentTime)));
      }

      var extraFiltersDict = ParseExtraFilters(query.ExtraFilters);
      foreach (var (key, value) in extraFiltersDict)
      {
        var snippet = $"{{\"{key}\": {value.ToLower()}}}";
        placesQuery = placesQuery.Where(p =>
            p.ExtraFilters != null && EF.Functions.JsonContains(p.ExtraFilters, snippet));
      }

      if (query.RadiusKm.HasValue && userPoint != null)
      {
          var radiusMeters = query.RadiusKm.Value * 1000;
          placesQuery = placesQuery.Where(p => p.Location != null && p.Location.IsWithinDistance(userPoint, radiusMeters));
      }

      placesQuery = query.SortBy?.ToLowerInvariant() switch
      {
          "popularity_asc" => placesQuery
              .OrderByDescending(p => p.Popularity)
              .ThenByDescending(p => p.AvgRating),

          "popularity_desc" => placesQuery
              .OrderBy(p => p.Popularity)
              .ThenBy(p => p.AvgRating),

          "rating_asc" => placesQuery
              .OrderByDescending(p => p.AvgRating)
              .ThenByDescending(p => p.Popularity),

          "rating_desc" => placesQuery
              .OrderBy(p => p.AvgRating)
              .ThenByDescending(p => p.Popularity),

          "nearest_asc" when userPoint != null => placesQuery
              .OrderBy(p => p.Location != null ? p.Location.Distance(userPoint) : double.MaxValue)
              .ThenByDescending(p => p.Popularity),

          "nearest_desc" when userPoint != null => placesQuery
              .OrderByDescending(p => p.Location != null ? p.Location.Distance(userPoint) : 0.0)
              .ThenByDescending(p => p.Popularity),

          "price_asc" => placesQuery
              .OrderBy(p => p.PriceRange == null ? 999 : p.PriceRange.Length)
              .ThenByDescending(p => p.Popularity),

          "price_desc" => placesQuery
              .OrderByDescending(p => p.PriceRange == null ? 0 : p.PriceRange.Length)
              .ThenByDescending(p => p.Popularity),

          _ => placesQuery
              .OrderByDescending(p => p.IsFeatured)
              .ThenByDescending(p => p.Popularity)
              .ThenByDescending(p => p.AvgRating)
    };

    var total = await placesQuery.CountAsync();

    var items = await ApplyPaging(placesQuery, query.Page, query.PageSize)
        .Select(p => new PlaceCardDto
        {
            Id = p.Id,
            Name = p.Name,
            Slug = p.Slug,
            Type = p.Type == null ? null : new TypeRefDto
            {
                Id = p.Type.Id,
                Name = p.Type.Name
            },
            AvgRating = p.AvgRating,
            Address = p.Address,
            PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
            PriceRange = p.PriceRange,
            DistanceKm = userPoint != null && p.Location != null
            ? Math.Round(p.Location.Distance(userPoint) / 1000.0, 2)
            : null,
            IsOpen = p.WorkingDays.Any(wd => 
              wd.DayOfWeek == currentDay && 
              !wd.IsClosed &&
              wd.Intervals.Any(i => i.OpensAt <= currentTime && i.ClosesAt >= currentTime)
            )
        })
        .ToListAsync();

      return (items, total);
    }

    private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
    {
      if (raw == null || raw.Count == 0) return new Dictionary<string, string>();
      var dict = new Dictionary<string, string>();
      foreach (var entry in raw)
      {
        var idx = entry.IndexOf(':');
        if (idx > 0)
          dict[entry[..idx]] = entry[(idx + 1)..];
      }
      return dict;
    }

    private static Point? BuildUserPoint(double? lat, double? lng)
    {
      if(!lat.HasValue || !lng.HasValue) return null;

      return new Point(lng.Value, lat.Value) { SRID = 4326 };
    }

    private static IQueryable<T> ApplyPaging<T>(IQueryable<T> query, int page, int pageSize)
    {
      var safePage = page < 1 ? 1 : page;
      var safePageSize = pageSize < 1 ? 12 : pageSize;

      return query.Skip((safePage - 1) * safePageSize).Take(safePageSize);
    }

    private static double? ToDistanceKm(double? meters)
    {
      if(!meters.HasValue) return null;

      return Math.Round(meters.Value / 1000.0, 2);
    }

    private static int GetCurrentDayOfWeekNumber()
    {
      var day = DateTime.UtcNow.DayOfWeek;

      return day switch
      {
        DayOfWeek.Monday => 1,
        DayOfWeek.Tuesday => 2,
        DayOfWeek.Wednesday => 3,
        DayOfWeek.Thursday => 4,
        DayOfWeek.Friday => 5,
        DayOfWeek.Saturday => 6,
        DayOfWeek.Sunday => 7,
        _ => 1
      };
    }

    private static TimeOnly GetCurrentUtcTimeOnly()
    {
      return TimeOnly.FromDateTime(DateTime.UtcNow);
    }
  }
}