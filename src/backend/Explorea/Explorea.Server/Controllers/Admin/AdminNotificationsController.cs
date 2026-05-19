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

        [HttpGet]
        public async Task<IActionResult> GetInbox([FromQuery] int take = 10)
        {
            var userId = GetCurrentUserId();
            var inbox = await _service.GetInboxAsync(userId, take);
            return Ok(inbox);
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

        [HttpPatch("{id:guid}/read")]
        public async Task<IActionResult> MarkAsRead(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _service.MarkAsReadAsync(userId, id);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetCurrentUserId();
            await _service.MarkAllAsReadAsync(userId);
            return NoContent();
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
