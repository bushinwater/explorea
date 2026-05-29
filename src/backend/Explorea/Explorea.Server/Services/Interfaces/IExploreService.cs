using Explorea.API.DTOs.Explore;

namespace Explorea.Server.Services.Interfaces
{
    public interface IExploreService
    {
        Task<ExploreMapResultDto> GetMapMarkersAsync(
            double? lat, double? lng, double radiusKm, string type, int limit,
            decimal? minRating, bool? openNow,
            List<int>? placeTypeIds = null, List<int>? activityCategoryIds = null,
            List<int>? eventTypeIds = null, List<int>? destinationTypeIds = null,
            decimal? minPrice = null, decimal? maxPrice = null, List<string>? extraFilters = null,
            int? regionId = null);

        Task<ExploreMarkerDto?> GetMarkerBySlugAsync(string entityType, string slug);
    }
}
