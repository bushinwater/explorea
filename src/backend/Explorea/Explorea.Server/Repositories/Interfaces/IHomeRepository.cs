using Explorea.API.Models;
using Explorea.Server.Repositories.Implementations;

namespace Explorea.Server.Repositories.Interfaces
{
  public interface IHomeRepository
  {
    Task<List<Destination>> GetHeroBannerDestinationAsync(int take, double? userLat, double? userLng);
    Task<List<Destination>> GetFeaturedDestinationsAsync(int take, double? userLat, double? userLng);
    Task<List<Event>> GetUpcomingEventsAsync(DateTimeOffset now, int take, double? userLat, double? userLng);
    Task<List<Activity>> GetPopularActivitiesAsync(int take, double? userLat, double? userLng);
    Task<List<ReviewWithEntityDto>> GetTravelerReviewsAsync(int take);
  }
}