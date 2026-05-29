using Explorea.API.Models;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IExploreRepository
    {
        Task<List<Destination>> GetNearbyDestinationsAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating,
            List<int>? destinationTypeIds = null, List<string>? extraFilters = null, int? regionId = null);
        Task<List<Place>> GetNearbyPlacesAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating, bool? openNow,
            List<int>? placeTypeIds = null, decimal? minPrice = null, decimal? maxPrice = null, List<string>? extraFilters = null, int? regionId = null);
        Task<List<Event>> GetNearbyEventsAsync(double? lat, double? lng, double radiusKm, int limit,
            decimal? minRating = null, List<int>? eventTypeIds = null, decimal? minPrice = null, decimal? maxPrice = null, int? regionId = null);
        Task<List<Activity>> GetNearbyActivitiesAsync(double? lat, double? lng, double radiusKm, int limit, decimal? minRating,
            List<int>? activityCategoryIds = null, int? regionId = null);

        Task<Destination?> GetDestinationBySlugAsync(string slug);
        Task<Place?> GetPlaceBySlugAsync(string slug);
        Task<Event?> GetEventBySlugAsync(string slug);
        Task<Activity?> GetActivityBySlugAsync(string slug);
    }
}
