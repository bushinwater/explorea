using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/stats")]
    [Authorize]
    public class AdminStatsController : ControllerBase
    {
        private readonly IAdminStatsService _service;

        public AdminStatsController(IAdminStatsService service)
        {
            _service = service;
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview()
        {
            try
            {
                var userId = GetCurrentUserId();
                var overview = await _service.GetOverviewAsync(userId);
                return Ok(overview);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("traffic")]
        public async Task<IActionResult> GetTraffic([FromQuery] int days = 30)
        {
            try
            {
                var userId = GetCurrentUserId();
                var traffic = await _service.GetTrafficAsync(userId, days);
                return Ok(traffic);
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
