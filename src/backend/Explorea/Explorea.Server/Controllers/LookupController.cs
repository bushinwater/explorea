using Explorea.Server.Repositories.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api")]
    public class LookupController : ControllerBase
    {
        private readonly ILookupRepository _lookup;
        private readonly IConfiguration _config;

        public LookupController(ILookupRepository lookup, IConfiguration config)
        {
            _lookup = lookup;
            _config = config;
        }

        [HttpGet("app-info")]
        public IActionResult GetAppInfo()
        {
            var country = _config["AppSettings:MarketCountry"] ?? "Srbija";
            return Ok(new { countryName = country });
        }

        [HttpGet("cities")]
        public async Task<IActionResult> GetCities([FromQuery] int? regionId = null)
        {
            var items = await _lookup.GetCitiesAsync(regionId);
            return Ok(items.Select(c => new { c.Id, c.Name }));
        }

        [HttpGet("regions")]
        public async Task<IActionResult> GetRegions()
        {
            var items = await _lookup.GetRegionsAsync();
            return Ok(items.Select(r => new { r.Id, r.Name }));
        }

        [HttpGet("place-types")]
        public async Task<IActionResult> GetPlaceTypes()
        {
            var items = await _lookup.GetPlaceTypesAsync();
            return Ok(items.Select(t => new { t.Id, t.Name }));
        }

        [HttpGet("event-types")]
        public async Task<IActionResult> GetEventTypes()
        {
            var items = await _lookup.GetEventTypesAsync();
            return Ok(items.Select(t => new { t.Id, t.Name }));
        }

        [HttpGet("activity-categories")]
        public async Task<IActionResult> GetActivityCategories()
        {
            var items = await _lookup.GetActivityCategoriesAsync();
            return Ok(items.Select(c => new { c.Id, c.Name }));
        }

        [HttpGet("seasons")]
        public async Task<IActionResult> GetSeasons()
        {
            var items = await _lookup.GetSeasonsAsync();
            return Ok(items.Select(s => new { s.Id, s.Name }));
        }

        [HttpGet("interest-tags")]
        public async Task<IActionResult> GetInterestTags()
        {
            var tags = await _lookup.GetInterestTagsAsync();
            return Ok(tags.Select(t => new { t.Id, t.Name, t.Icon }));
        }

        [HttpGet("destination-types")]
        public async Task<IActionResult> GetDestinationTypes()
        {
            var items = await _lookup.GetDestinationTypesAsync();
            return Ok(items.Select(t => new { t.Id, t.Name, t.Icon }));
        }

        [HttpGet("region-by-coords")]
        public async Task<IActionResult> GetRegionByCoords([FromQuery] double lat, [FromQuery] double lng)
        {
            // PostGIS will throw on NaN/Infinity and silently misbehave on
            // out-of-range geographic coordinates; reject at the boundary so
            // malformed input doesn't bubble into the SQL layer.
            if (double.IsNaN(lat) || double.IsInfinity(lat) || lat < -90 || lat > 90)
                return BadRequest(new { message = "lat must be between -90 and 90." });
            if (double.IsNaN(lng) || double.IsInfinity(lng) || lng < -180 || lng > 180)
                return BadRequest(new { message = "lng must be between -180 and 180." });

            var (regionId, countryId) = await _lookup.GetRegionByCoordinatesAsync(lat, lng);
            return Ok(new { regionId, countryId });
        }

        [HttpGet("filter-definitions")]
        public async Task<IActionResult> GetFilterDefinitions([FromQuery] string entityType, [FromQuery] int typeId)
        {
            if (string.IsNullOrWhiteSpace(entityType) || typeId <= 0)
                return BadRequest("entityType and typeId are required.");

            var defs = await _lookup.GetFilterDefinitionsAsync(entityType.Trim().ToLower(), typeId);
            return Ok(defs.Select(d => new
            {
                d.Id,
                d.FilterKey,
                d.FilterLabel,
                d.FilterType,
                d.SortOrder,
                Options = d.Options.Select(o => new { o.OptionValue, o.OptionLabel })
            }));
        }
    }
}
