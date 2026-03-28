using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api")]
    public class LookupController : ControllerBase
    {
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

        [HttpGet("interests")]
        public IActionResult GetInterests() => Ok();
    }
}
