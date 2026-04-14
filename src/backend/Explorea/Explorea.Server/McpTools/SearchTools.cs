using System.ComponentModel;
using System.Text.Json;
using Explorea.Server.Services.Interfaces;
using ModelContextProtocol.Server;

namespace Explorea.Server.McpTools
{
    [McpServerToolType]
    public class SearchTools(ISearchService searchService, IExploreService exploreService)
    {
        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        [McpServerTool(Name = "search"), Description(
            "Full-text search across all content: destinations, places, events and activities. " +
            "Use this when the user asks to find something by name, keyword, or category. " +
            "Returns a ranked list of matching results with name, type, rating, and location info.")]
        public async Task<string> Search(
            [Description("Search term entered by the user")] string query,
            [Description("Maximum number of results to return (1-10, default 10)")] int limit = 10)
        {
            var result = await searchService.SearchAsync(query, limit);
            return JsonSerializer.Serialize(result, _json);
        }

        [McpServerTool(Name = "get_map_markers"), Description(
            "Returns geographic map markers (destinations, places, events, activities) " +
            "within a radius around a given location. " +
            "Use this when the user wants to explore what is nearby or asks for suggestions near a location. " +
            "Each marker includes name, type, coordinates, rating, and subtitle.")]
        public async Task<string> GetMapMarkers(
            [Description("Latitude of the center point")] double lat,
            [Description("Longitude of the center point")] double lng,
            [Description("Search radius in kilometers (1-200, default 50)")] double radiusKm = 50,
            [Description("Filter by entity type: 'all', 'destination', 'place', 'event', or 'activity' (default 'all')")] string type = "all",
            [Description("Maximum total number of markers to return (1-500, default 200)")] int limit = 200)
        {
            var validTypes = new[] { "all", "destination", "place", "event", "activity" };

            if (!validTypes.Contains(type))
                return JsonSerializer.Serialize(
                    new { error = $"Invalid type '{type}'. Allowed: all, destination, place, event, activity." }, _json);

            var result = await exploreService.GetMapMarkersAsync(lat, lng, radiusKm, type, limit, null, null);
            return JsonSerializer.Serialize(result, _json);
        }
    }
}
