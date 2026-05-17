using Explorea.API.DTOs.Admin.Event;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/events")]
    [Authorize]
    public class AdminEventsController : ControllerBase
    {
        private readonly IAdminEventService _service;
        private readonly IAdminQueueService _queueService;

        public AdminEventsController(IAdminEventService service, IAdminQueueService queueService)
        {
            _service      = service;
            _queueService = queueService;
        }

        // GET /api/admin/events
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search,
            [FromQuery] Guid? destinationId,
            [FromQuery] int? cityId,
            [FromQuery] int? typeId,
            [FromQuery] DateTimeOffset? startFrom,
            [FromQuery] DateTimeOffset? startTo,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(
                    search, destinationId, cityId, typeId, startFrom, startTo, page, pageSize, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/events/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.GetByIdAsync(id, userId);
                if (result == null) return NotFound();
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/events
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateEventDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _service.CreateAsync(dto, userId);
                return StatusCode(201, created);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // PUT /api/admin/events/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateEventDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateAsync(id, dto, userId);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // PUT /api/admin/events/{queueItemId}/approve
        [HttpPut("{queueItemId}/approve")]
        public async Task<IActionResult> Approve(Guid queueItemId)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _queueService.ApproveByTOAsync(queueItemId, userId);
                return Ok();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // PUT /api/admin/events/{queueItemId}/reject
        [HttpPut("{queueItemId}/reject")]
        public async Task<IActionResult> Reject(Guid queueItemId, [FromBody] RejectEventDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _queueService.RejectByTOAsync(queueItemId, userId, dto.Reason);
                return Ok();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // DELETE /api/admin/events/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteAsync(id, userId);
                if (!deleted) return NotFound();
                return NoContent();
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

    public class RejectEventDto
    {
        public string Reason { get; set; } = null!;
    }
}
