using Explorea.API.Models;
using Explorea.Server.Repositories.Models;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ISearchRepository
    {
        Task<(List<Destination> Destinations, List<Place> Places,
              List<Event> Events, List<Activity> Activities, int Total)>
            SearchAsync(string? q, string type, int? cityId,
                       decimal? minRating, decimal? maxPrice, int page, int pageSize);

        Task<(List<Place> Places, List<Event> Events, List<Activity> Activities)>
            SearchMapAsync(double lat, double lng, double radiusKm, string type);

        // DEDICATED METODE
        Task<List<SearchProjection<Destination>>> SearchDestinationsAsync(string query, int take = 25);
        Task<List<SearchProjection<Place>>> SearchPlacesAsync(string query, int take = 25);
        Task<List<SearchProjection<Event>>> SearchEventsAsync(string query, DateTimeOffset now, int take = 25);
        Task<List<SearchProjection<Activity>>> SearchActivitiesAsync(string query, int take = 25);

    }
}