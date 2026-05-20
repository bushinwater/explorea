using Explorea.API.DTOs.Admin.Queue;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/queue")]
    [Authorize]
    public class AdminQueueController : ControllerBase
    {
        private readonly IAdminQueueService _service;

        public AdminQueueController(IAdminQueueService service)
        {
            _service = service;
        }

        // GET /api/admin/queue?destinationId=&status=
        [HttpGet]
        public async Task<IActionResult> GetQueue(
            [FromQuery] Guid? destinationId,
            [FromQuery] string? status,
            [FromQuery] string? entityType,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetCurrentUserId();
            var (items, total) = await _service.GetQueueAsync(
                destinationId, status, entityType, page, pageSize, userId);
            return Ok(new { total, items });
        }

        // GET /api/admin/queue/owner
        [HttpGet("owner")]
        public async Task<IActionResult> GetOwnerQueue()
        {
            var userId = GetCurrentUserId();
            var items = await _service.GetOwnerQueueAsync(userId);
            return Ok(items);
        }

        // POST /api/admin/queue/{id}/approve
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveByTO(Guid id)
        {
            var userId = GetCurrentUserId();
            await _service.ApproveByTOAsync(id, userId);
            return Ok();
        }

        // POST /api/admin/queue/{id}/reject
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectByTO(Guid id, [FromBody] QueueReviewDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest("Reason is required when rejecting.");

            var userId = GetCurrentUserId();
            await _service.RejectByTOAsync(id, userId, dto.Reason);
            return Ok();
        }

        // POST /api/admin/queue/{id}/owner-approve
        [HttpPost("{id}/owner-approve")]
        public async Task<IActionResult> ApproveByOwner(Guid id)
        {
            var userId = GetCurrentUserId();
            await _service.ApproveByOwnerAsync(id, userId);
            return Ok();
        }

        // POST /api/admin/queue/{id}/owner-reject
        [HttpPost("{id}/owner-reject")]
        public async Task<IActionResult> RejectByOwner(Guid id, [FromBody] QueueReviewDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest("Reason is required when rejecting.");

            var userId = GetCurrentUserId();
            await _service.RejectByOwnerAsync(id, userId, dto.Reason);
            return Ok();
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
