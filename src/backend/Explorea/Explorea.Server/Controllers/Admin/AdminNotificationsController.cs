using Explorea.API.DTOs.Admin.Notification;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/notifications")]
    [Authorize]
    public class AdminNotificationsController : ControllerBase
    {
        private readonly IAdminNotificationService _service;

        public AdminNotificationsController(IAdminNotificationService service)
        {
            _service = service;
        }

        [HttpPost("broadcast")]
        public async Task<IActionResult> Broadcast([FromBody] AdminBroadcastNotificationRequestDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.BroadcastAsync(dto, userId);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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
