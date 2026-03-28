using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        [HttpPost("register")]
        public IActionResult Register() => Ok();

        [HttpPost("login")]
        public IActionResult Login() => Ok();

        [HttpPost("refresh")]
        public IActionResult Refresh() => Ok();

        [HttpPost("logout")]
        public IActionResult Logout() => NoContent();

        [HttpPost("forgot-password")]
        public IActionResult ForgotPassword() => Ok();

        [HttpPost("reset-password")]
        public IActionResult ResetPassword() => Ok();
    }
}
