using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/destinations")]
    public class DestinationsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpGet("{slug}")]
        public IActionResult GetBySlug(string slug) => Ok();
    }
}
