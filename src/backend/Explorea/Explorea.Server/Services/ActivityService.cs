using System.Text.Json;
using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Review;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using ActivityModel = Explorea.API.Models.Activity;
using ReviewModel = Explorea.API.Models.Review;

namespace Explorea.Server.Services
{
  public class ActivityService : IActivityService
  {
    private readonly IActivityRepository _activityRepository;

    public ActivityService(IActivityRepository activityRepository)
    {
      _activityRepository = activityRepository;
    }
    
    public async Task<ActivityDetailDto?> GetBySlugAsync(string slug)
    {
      var activity = await _activityRepository.GetActivityDetailsBySlugAsync(slug);
      if (activity is null) return null;

      var reviews = await _activityRepository.GetActivityReviewsAsync(activity.Id);
      var similarActivities = await _activityRepository.GetSimilarActivitiesAsync(activity);

      return new ActivityDetailDto
      {
          Id = activity.Id,
          Name = activity.Name,
          Slug = activity.Slug,
          Category = activity.Category == null
              ? null
              : new CategoryRefDto
              {
                  Id = activity.Category.Id,
                  Name = activity.Category.Name
              },
          AvgRating = activity.AvgRating,
          DurationMinutes = activity.DurationMinutes,
          Price = activity.Price,
          DifficultyLevel = activity.DifficultyLevel,
          PreviewImageUrl = activity.Images
              .OrderBy(i => i.SortOrder)
              .Select(i => i.ImageUrl)
              .FirstOrDefault(),
          Popularity = activity.Popularity,
          Country = null,
      
          Description = activity.Description,
          Season = activity.Season == null
              ? null
              : new SeasonRefDto
              {
                  Id = activity.Season.Id,
                  Name = activity.Season.Name
              },
          DistanceKm = activity.DistanceKm,
          StartPoint = activity.StartPoint,
          ExtraData = ParseExtraData(activity.ExtraData),
          Location = activity.Latitude.HasValue && activity.Longitude.HasValue
              ? new LocationDto
              {
                  Lat = activity.Latitude.Value,
                  Lng = activity.Longitude.Value
              }
              : null,
          Inclusions = activity.Inclusions
              .Select(i => new InclusionDto
              {
                  Id = i.Id,
                  Item = i.Item
              })
              .ToList(),
          Images = activity.Images
              .OrderBy(i => i.SortOrder)
              .Select(i => new ActivityImageDto
              {
                  ImageUrl = i.ImageUrl,
                  SortOrder = i.SortOrder
              })
              .ToList(),
          Reviews = reviews.Select(MapReview).ToList(),
          SimilarActivities = similarActivities
              .Where(a => a.Id != activity.Id && a.Slug != activity.Slug)
              .Select(MapActivityCard)
              .ToList()
      };
    }
    private static object? ParseExtraData(string? extraData)
    {
      if(string.IsNullOrWhiteSpace(extraData)) return null;

      try
      {
        return JsonSerializer.Deserialize<object>(extraData);
      }
      catch
      {  
        return extraData;
      }  
    }

    private static ActivityCardDto MapActivityCard(ActivityModel activity)
    {
      return new ActivityCardDto
      {
        Id = activity.Id,
        Name = activity.Name, 
        Slug = activity.Slug,
        Category = activity.Category == null ? null : new CategoryRefDto
                                                      {
                                                        Id = activity.Category.Id,
                                                        Name = activity.Category.Name  
                                                      },
        AvgRating = activity.AvgRating,
        DurationMinutes = activity.DurationMinutes,
        Price = activity.Price,
        DifficultyLevel = activity.DifficultyLevel,
        PreviewImageUrl = activity.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault(),
        Popularity = activity.Popularity,
        Country = null
      };
    }

    private static ReviewDto MapReview(ReviewModel review)
    {
      return new ReviewDto
      {
        Id = review.Id,
        Rating = review.Rating,
        Comment = review.Comment,
        CreatedAt = review.CreatedAt,
        User = new ReviewUserDto
        {
          Id = review.User.Id,
          FirstName = review.User.FirstName,
          LastName = review.User.LastName,
          TravelerRank = review.User.TravelerRank
        }
      };
    }
  }
}