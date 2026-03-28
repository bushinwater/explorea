using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/interests")]
    public class InterestsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();
    }
}
