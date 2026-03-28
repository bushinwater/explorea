using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/users")]
    public class AdminUsersController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpPut("{id}/status")]
        public IActionResult SetStatus(Guid id) => Ok();
    }
}
