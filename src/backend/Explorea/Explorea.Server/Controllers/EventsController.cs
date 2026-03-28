using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/events")]
    public class EventsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpGet("{slug}")]
        public IActionResult GetBySlug(string slug) => Ok();

        [HttpGet("calendar")]
        public IActionResult GetCalendar() => Ok();
    }
}
