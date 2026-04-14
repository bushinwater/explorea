using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Home;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Review;
using Explorea.API.Models;
using Explorea.Server.Repositories.Implementations;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
  public class HomeService : IHomeService
  {
    private readonly IHomeRepository _homeRepository;

    public HomeService(IHomeRepository homeRepository)
    {
      _homeRepository = homeRepository;
    }

    public async Task<HomeDataDto> GetHomeDataAsync()
    {
      var now = DateTimeOffset.UtcNow;

      var hero = await _homeRepository.GetHeroBannerDestinationAsync(5);
      var destinations = await _homeRepository.GetFeaturedDestinationsAsync(8);
      var events = await _homeRepository.GetUpcomingEventsAsync(now, 8);
      var activities = await _homeRepository.GetPopularActivitiesAsync(8);
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
      PreviewImageUrl = d.PreviewImageUrl,
      AvgRating = d.AvgRating,
      HeroImageUrl = d.HeroImageUrl,
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
      ImageUrl = d.HeroImageUrl ?? d.PreviewImageUrl ?? "",
      LinkType = "destination",
      LinkSlug = d.Slug
    };

    public Task<RecommendationsDto> GetRecommendationsAsync()
    {
      return Task.FromResult(new RecommendationsDto());
    }
  }
}