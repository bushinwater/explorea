using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/reviews")]
    [Authorize]
    public class AdminReviewsController : ControllerBase
    {
        private readonly IAdminReviewService _service;

        public AdminReviewsController(IAdminReviewService service)
        {
            _service = service;
        }

        // GET /api/admin/reviews
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? entityType,
            [FromQuery] int? subtypeId,
            [FromQuery] int? cityId,
            [FromQuery] int? regionId,
            [FromQuery] short? minRating,
            [FromQuery] short? maxRating,
            [FromQuery] string? gender,
            [FromQuery] int? minAge,
            [FromQuery] int? maxAge,
            [FromQuery] bool? isHidden,
            [FromQuery] string? search,
            [FromQuery] List<string>? extraFilters,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(
                    entityType, subtypeId, cityId, regionId, minRating, maxRating,
                    gender, minAge, maxAge, isHidden,
                    page, pageSize, userId, search, extraFilters);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reviews/{id}
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

        // PUT /api/admin/reviews/{id}/hide
        [HttpPut("{id}/hide")]
        public async Task<IActionResult> Hide(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.HideAsync(id, userId);
                if (!result) return NotFound();
                return Ok();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // PUT /api/admin/reviews/{id}/approve
        [HttpPut("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.ApproveAsync(id, userId);
                if (!result) return NotFound();
                return Ok();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // DELETE /api/admin/reviews/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, [FromBody] DeleteReviewRequest? body)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.DeleteAsync(id, userId, body?.Reason);
                if (!result) return NotFound();
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

    public class DeleteReviewRequest
    {
        public string? Reason { get; set; }
    }
}
