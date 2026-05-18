using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/activity")]
    [Authorize]
    public class AdminActivityController : ControllerBase
    {
        private readonly IAdminActivityFeedService _service;

        public AdminActivityController(IAdminActivityFeedService service)
        {
            _service = service;
        }

        [HttpGet("recent")]
        public async Task<IActionResult> GetRecent([FromQuery] int limit = 10)
        {
            try
            {
                var userId = GetCurrentUserId();
                var activity = await _service.GetRecentAsync(userId, limit);
                return Ok(activity);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
