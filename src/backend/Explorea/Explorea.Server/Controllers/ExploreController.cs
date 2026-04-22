using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/explore")]
    public class ExploreController : ControllerBase
    {
        private readonly IExploreService _exploreService;

        public ExploreController(IExploreService exploreService)
        {
            _exploreService = exploreService;
        }

        // GET /api/explore/marker?type=destination&slug=beograd
        [HttpGet("marker")]
        public async Task<IActionResult> GetMarkerBySlug(
            [FromQuery] string type,
            [FromQuery] string slug)
        {
            var validTypes = new[] { "destination", "place", "event", "activity" };
            if (!validTypes.Contains(type))
                return BadRequest("Nevalidan tip.");

            if (string.IsNullOrWhiteSpace(slug))
                return BadRequest("Slug je obavezan.");

            var marker = await _exploreService.GetMarkerBySlugAsync(type, slug);
            if (marker is null)
                return NotFound();

            return Ok(marker);
        }

        // GET /api/explore/map?lat=44.8&lng=20.4&radius=50&type=all&limit=200&minRating=4&openNow=true
        // lat/lng su opcioni — ako nisu prosleđeni, geografski filter se preskače
        [HttpGet("map")]
        public async Task<IActionResult> GetMapMarkers(
            [FromQuery] double? lat = null,
            [FromQuery] double? lng = null,
            [FromQuery] double radius = 50,
            [FromQuery] string type = "all",
            [FromQuery] int limit = 200,
            [FromQuery] decimal? minRating = null,
            [FromQuery] bool? openNow = null,
            [FromQuery] int[]? placeTypeIds = null,
            [FromQuery] int[]? activityCategoryIds = null,
            [FromQuery] int[]? eventTypeIds = null,
            [FromQuery] int[]? destinationTypeIds = null,
            [FromQuery] decimal? minPrice = null,
            [FromQuery] decimal? maxPrice = null,
            [FromQuery] string[]? extraFilters = null)
        {
            var validTypes = new[] { "all", "destination", "place", "event", "activity" };
            if (!validTypes.Contains(type))
                return BadRequest("Nevalidan tip. Dozvoljeni tipovi: all, destination, place, event, activity.");

            if (lat.HasValue != lng.HasValue)
                return BadRequest("Potrebno je proslediti i lat i lng, ili nijedno.");

            var result = await _exploreService.GetMapMarkersAsync(
                lat, lng, radius, type, limit, minRating, openNow,
                placeTypeIds?.ToList(), activityCategoryIds?.ToList(),
                eventTypeIds?.ToList(), destinationTypeIds?.ToList(),
                minPrice, maxPrice, extraFilters?.ToList());
            return Ok(result);
        }
    }
}
