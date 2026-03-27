using Explorea.API.Models;
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
    }
}