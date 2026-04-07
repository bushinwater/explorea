using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
  public interface IHomeRepository
  {
    Task<List<Destination>> GetHeroBannerDestinationAsync(int take);
    Task<List<Destination>> GetFeaturedDestinationsAsync(int take);
    Task<List<Event>> GetUpcomingEventsAsync(DateTimeOffset now, int take);
    Task<List<Activity>> GetPopularActivitiesAsync(int take);
    Task<List<Review>> GetTravelerReviewsAsync(int take);
  }
}