using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/search")]
    public class SearchController : ControllerBase
    {
        [HttpGet]
        public IActionResult Search() => Ok();

        [HttpGet("map")]
        public IActionResult SearchMap() => Ok();
    }
}
