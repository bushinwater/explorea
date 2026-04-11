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

        // GET /api/explore/map?lat=44.8&lng=20.4&radius=50&type=all&limit=200
        [HttpGet("map")]
        public async Task<IActionResult> GetMapMarkers(
            [FromQuery] double lat,
            [FromQuery] double lng,
            [FromQuery] double radius = 50,
            [FromQuery] string type = "all",
            [FromQuery] int limit = 200)
        {
            var validTypes = new[] { "all", "destination", "place", "event", "activity" };
            if (!validTypes.Contains(type))
                return BadRequest("Nevalidan tip. Dozvoljeni tipovi: all, destination, place, event, activity.");

            var result = await _exploreService.GetMapMarkersAsync(lat, lng, radius, type, limit);
            return Ok(result);
        }
    }
}
