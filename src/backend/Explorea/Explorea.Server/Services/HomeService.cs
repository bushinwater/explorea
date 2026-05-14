using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Home;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Review;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Implementations;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
  public class HomeService : IHomeService
  {
    private readonly IHomeRepository _homeRepository;
    private readonly AppDbContext _db;

    public HomeService(IHomeRepository homeRepository, AppDbContext db)
    {
      _homeRepository = homeRepository;
      _db = db;
    }

    public async Task<HomeDataDto> GetHomeDataAsync(HomeQueryDto query)
    {
      var now = DateTimeOffset.UtcNow;

      var hero = await _homeRepository.GetHeroBannerDestinationAsync(5, query.UserLat, query.UserLng);
      var destinations = await _homeRepository.GetFeaturedDestinationsAsync(8, query.UserLat, query.UserLng, query.CityId);
      var events = await _homeRepository.GetUpcomingEventsAsync(now, 8, query.UserLat, query.UserLng, query.CityId);
      var activities = await _homeRepository.GetPopularActivitiesAsync(8, query.UserLat, query.UserLng, query.CityId);
      var reviews = await _homeRepository.GetTravelerReviewsAsync(15);

      return new HomeDataDto
      {
        HeroBanners = hero.Select(MapHeroBanner).ToList(),
        FeaturedDestinations = destinations.Select(MapDestinationCard).ToList(),
        UpcomingEvents = events.Select(MapEventCard).ToList(),
        PopularActivities = activities.Select(MapActivityCard).ToList(),
        TravelerReviews = reviews.Select(MapReview).ToList()
      };
    }

    private static DestinationCardDto MapDestinationCard(Destination d) => new()
    {
      Id = d.Id,
      Name = d.Name,
      Slug = d.Slug,
      PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
      AvgRating = d.AvgRating,
      HeroImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
      Popularity = d.Popularity,
      IsFeatured = d.IsFeatured,
      City = d.City == null ? null : new CityRefDto
      {
        Id = d.City.Id,
        Name = d.City.Name
      },
      Country = d.Country == null ? null : new CountryRefDto
      {
        Id = d.Country.Id,
        Name = d.Country.Name,
        Code = d.Country.Code
      },
      Location = new LocationDto
      {
        Lat = d.Latitude!.Value,
        Lng = d.Longitude!.Value
      }
    };

    private static ReviewDto MapReview(ReviewWithEntityDto d) => new()
    {
      Id = d.Review.Id,
      Rating = d.Review.Rating,
      Comment = d.Review.Comment,
      CreatedAt = d.Review.CreatedAt,
      EntityType = d.Review.EntityType,
      EntityName = d.EntityName,
      EntitySlug = d.EntitySlug,
      User = new ReviewUserDto
      {
        Id = d.Review.User.Id,
        FirstName = d.Review.User.FirstName,
        LastName = d.Review.User.LastName,
        TravelerRank = d.Review.User.TravelerRank,
        ProfileImageUrl = d.Review.User.ProfileImageUrl
      }
    };

    private static ActivityCardDto MapActivityCard(Activity a) => new()
    {
      Id = a.Id,
      Name = a.Name,
      Slug = a.Slug,
      AvgRating = a.AvgRating,
      DurationMinutes = a.DurationMinutes,
      Price = a.Price,
      DifficultyLevel = a.DifficultyLevel,
      Popularity = a.Popularity,
      PreviewImageUrl = a.Images
        .OrderBy(i => i.SortOrder)
        .Select(i => i.ImageUrl)
        .FirstOrDefault(),
      Category = new CategoryRefDto
      {
        Id = a.Category.Id,
        Name = a.Category.Name
      },
      Country = a.Country == null ? null : new CountryRefDto
      {
        Id = a.Country.Id,
        Name = a.Country.Name,
        Code = a.Country.Code
      }
    };

    private static EventCardDto MapEventCard(Event e) => new()
    {
      Id = e.Id,
      Name = e.Name,
      Slug = e.Slug,
      StartDatetime = e.StartDatetime,
      EndDatetime = e.EndDatetime,
      Price = e.Price,
      Address = e.Address,
      PreviewImageUrl = e.Images
        .OrderBy(i => i.SortOrder)
        .Select(i => i.ImageUrl)
        .FirstOrDefault(),
      IsFeatured = e.IsFeatured,
      Popularity = e.Popularity,
      Type = new TypeRefDto
      {
        Id = e.Type.Id,
        Name = e.Type.Name
      },
      City = e.City == null ? null : new CityRefDto
      {
        Id = e.City.Id,
        Name = e.City.Name
      },
      Country = e.Country == null ? null : new CountryRefDto
      {
        Id = e.Country.Id,
        Name = e.Country.Name,
        Code = e.Country.Code
      }
    };

    private static HeroBannerDto MapHeroBanner(Destination d) => new()
    {
      Id = d.Id,
      Title = d.Name,
      ImageUrl = d.HeroImageUrl ?? "",
      LinkType = "destination",
      LinkSlug = d.Slug
    };

    public async Task<RecommendationsDto> GetRecommendationsAsync(Guid? userId, double? userLat, double? userLng)
    {
      if (userId.HasValue)
      {
        var userScores = await _db.UserInterestScores
            .Where(x => x.UserId == userId.Value && x.Score > 0)
            .ToDictionaryAsync(x => x.InterestTagId, x => x.Score);

        if (userScores.Count > 0)
        {
          var tagIds = userScores.Keys.ToList();

          var destIds = await _db.DestinationInterestTags
              .Where(x => tagIds.Contains(x.InterestTagId))
              .Select(x => x.DestinationId).Distinct().ToListAsync();

          var eventIds = await _db.EventInterestTags
              .Where(x => tagIds.Contains(x.InterestTagId))
              .Select(x => x.EventId).Distinct().ToListAsync();

          var actIds = await _db.ActivityInterestTags
              .Where(x => tagIds.Contains(x.InterestTagId))
              .Select(x => x.ActivityId).Distinct().ToListAsync();

          var destinations = await _db.Destinations
              .Where(d => destIds.Contains(d.Id))
              .Include(d => d.City).Include(d => d.Country)
              .Take(20).ToListAsync();

          var destTagMap = await _db.DestinationInterestTags
              .Where(x => destIds.Contains(x.DestinationId))
              .GroupBy(x => x.DestinationId)
              .ToDictionaryAsync(g => g.Key, g => g.Select(x => x.InterestTagId).ToList());

          var events = await _db.Events
              .Where(e => eventIds.Contains(e.Id))
              .Include(e => e.Images).Include(e => e.Type)
              .Include(e => e.City).Include(e => e.Country)
              .Include(e => e.InterestTags)
              .Take(20).ToListAsync();

          var activities = await _db.Activities
              .Where(a => actIds.Contains(a.Id))
              .Include(a => a.Images).Include(a => a.Category).Include(a => a.Country)
              .Include(a => a.InterestTags)
              .Take(20).ToListAsync();

          if (destinations.Count > 0 || events.Count > 0 || activities.Count > 0)
          {
            var sortedDests = destinations
                .OrderByDescending(d => (destTagMap.TryGetValue(d.Id, out var tags) ? tags : new()).Sum(tid => userScores.GetValueOrDefault(tid, 0)))
                .ThenBy(d => DistanceSq(userLat, userLng, d.Latitude, d.Longitude))
                .ThenByDescending(d => d.IsFeatured)
                .ThenByDescending(d => d.Popularity)
                .Take(6).ToList();

            var sortedEvents = events
                .OrderByDescending(e => e.InterestTags.Sum(t => userScores.GetValueOrDefault(t.InterestTagId, 0)))
                .ThenBy(e => DistanceSq(userLat, userLng, e.Latitude, e.Longitude))
                .ThenByDescending(e => e.IsFeatured)
                .ThenByDescending(e => e.Popularity)
                .Take(6).ToList();

            var sortedActs = activities
                .OrderByDescending(a => a.InterestTags.Sum(t => userScores.GetValueOrDefault(t.InterestTagId, 0)))
                .ThenBy(a => DistanceSq(userLat, userLng, a.Latitude, a.Longitude))
                .ThenByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.Popularity)
                .Take(6).ToList();

            return new RecommendationsDto
            {
              Destinations = sortedDests.Select(MapDestinationCard).ToList(),
              Events       = sortedEvents.Select(MapEventCard).ToList(),
              Activities   = sortedActs.Select(MapActivityCard).ToList()
            };
          }
        }
      }

      // Fallback — featured + lokacija + popularnost
      var topDests = await _db.Destinations
          .Include(d => d.City).Include(d => d.Country)
          .Take(30).ToListAsync();

      var topEvents = await _db.Events
          .Include(e => e.Images).Include(e => e.Type).Include(e => e.City).Include(e => e.Country)
          .Take(30).ToListAsync();

      var topActs = await _db.Activities
          .Include(a => a.Images).Include(a => a.Category).Include(a => a.Country)
          .Take(30).ToListAsync();

      return new RecommendationsDto
      {
        Destinations = topDests
            .OrderBy(d => DistanceSq(userLat, userLng, d.Latitude, d.Longitude))
            .ThenByDescending(d => d.IsFeatured)
            .ThenByDescending(d => d.Popularity)
            .Take(6).Select(MapDestinationCard).ToList(),
        Events = topEvents
            .OrderBy(e => DistanceSq(userLat, userLng, e.Latitude, e.Longitude))
            .ThenByDescending(e => e.IsFeatured)
            .ThenByDescending(e => e.Popularity)
            .Take(6).Select(MapEventCard).ToList(),
        Activities = topActs
            .OrderBy(a => DistanceSq(userLat, userLng, a.Latitude, a.Longitude))
            .ThenByDescending(a => a.IsFeatured)
            .ThenByDescending(a => a.Popularity)
            .Take(6).Select(MapActivityCard).ToList()
      };
    }

    private static double DistanceSq(double? lat1, double? lng1, double? lat2, double? lng2)
    {
      if (!lat1.HasValue || !lng1.HasValue || !lat2.HasValue || !lng2.HasValue)
        return double.MaxValue;
      var dlat = lat1.Value - lat2.Value;
      var dlng = lng1.Value - lng2.Value;
      return dlat * dlat + dlng * dlng;
    }
  }
}