using Explorea.API.Models;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IExploreRepository
    {
        Task<List<Destination>> GetNearbyDestinationsAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating);
        Task<List<Place>> GetNearbyPlacesAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating, bool? openNow);
        Task<List<Event>> GetNearbyEventsAsync(double? lat, double? lng, double radiusKm, int limit);
        Task<List<Activity>> GetNearbyActivitiesAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating);

        Task<Destination?> GetDestinationBySlugAsync(string slug);
        Task<Place?> GetPlaceBySlugAsync(string slug);
        Task<Event?> GetEventBySlugAsync(string slug);
        Task<Activity?> GetActivityBySlugAsync(string slug);
    }
}
