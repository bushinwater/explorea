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
        public IActionResult GetCities() => Ok();

        [HttpGet("regions")]
        public IActionResult GetRegions() => Ok();

        [HttpGet("place-types")]
        public IActionResult GetPlaceTypes() => Ok();

        [HttpGet("event-types")]
        public IActionResult GetEventTypes() => Ok();

        [HttpGet("activity-categories")]
        public IActionResult GetActivityCategories() => Ok();

        [HttpGet("seasons")]
        public IActionResult GetSeasons() => Ok();

        [HttpGet("interest-tags")]
        public async Task<IActionResult> GetInterestTags()
        {
            var tags = await _lookup.GetInterestTagsAsync();
            return Ok(tags.Select(t => new { t.Id, t.Name, t.Icon }));
        }
    }
}
