using Explorea.API.DTOs.Explore;

namespace Explorea.Server.Services.Interfaces
{
    public interface IExploreService
    {
        Task<ExploreMapResultDto> GetMapMarkersAsync(
            double lat, double lng, double radiusKm, string type, int limit);
    }
}
