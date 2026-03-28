using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        [HttpGet("me")]
        public IActionResult GetMe() => Ok();

        [HttpPut("me")]
        public IActionResult Update() => Ok();

        [HttpPut("me/preferences")]
        public IActionResult UpdatePreferences() => Ok();

        [HttpGet("me/interests")]
        public IActionResult GetInterests() => Ok();

        [HttpPost("me/interests")]
        public IActionResult UpdateInterests() => Ok();
    }
}
