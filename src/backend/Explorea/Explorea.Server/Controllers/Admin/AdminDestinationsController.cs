using Explorea.API.DTOs.Admin.Destination;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/destinations")]
    [Authorize]
    public class AdminDestinationsController : ControllerBase
    {
        private readonly IAdminDestinationService _service;

        public AdminDestinationsController(IAdminDestinationService service)
        {
            _service = service;
        }

        // GET /api/admin/destinations
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search,
            [FromQuery] int? cityId,
            [FromQuery] string? visibility,
            [FromQuery] int? regionId,
            [FromQuery] int? typeId,
            [FromQuery] decimal? minRating,
            [FromQuery] decimal? maxRating,
            [FromQuery] bool? isFeatured,
            [FromQuery] List<string>? extraFilters,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(
                    search,
                    cityId,
                    visibility,
                    regionId,
                    typeId,
                    minRating,
                    maxRating,
                    isFeatured,
                    page,
                    pageSize,
                    userId,
                    extraFilters);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/stats
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var userId = GetCurrentUserId();
                var stats = await _service.GetStatsAsync(userId);
                return Ok(stats);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/regions
        [HttpGet("regions")]
        public async Task<IActionResult> GetRegions()
        {
            try
            {
                var userId = GetCurrentUserId();
                var regions = await _service.GetRegionsAsync(userId);
                return Ok(regions);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/destinations/types
        [HttpPost("types")]
        public async Task<IActionResult> CreateType([FromBody] CreateTypeRequest request)
        {
            try
            {
                var userId = GetCurrentUserId();
                var type = await _service.CreateTypeAsync(request.Name, userId);
                return StatusCode(201, type);
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/destinations/types
        [HttpGet("types")]
        public async Task<IActionResult> GetTypes()
        {
            try
            {
                var userId = GetCurrentUserId();
                var types = await _service.GetTypesAsync(userId);
                return Ok(types);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/{id}
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

        // POST /api/admin/destinations
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateDestinationDto dto)
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

        // PUT /api/admin/destinations/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateDestinationDto dto)
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

        // DELETE /api/admin/destinations/{id}
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

        // POST /api/admin/destinations/{id}/images
        [HttpPost("{id}/images")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> AddImage(Guid id, IFormFile file)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.AddImageAsync(id, file, userId);
                return Ok(result);
            }
            catch (KeyNotFoundException) { return NotFound(); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // PUT /api/admin/destinations/{id}/images/{imageId}/preview
        [HttpPut("{id}/images/{imageId}/preview")]
        public async Task<IActionResult> SetPreviewImage(Guid id, Guid imageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var previewUrl = await _service.SetPreviewImageAsync(id, imageId, userId);
                if (previewUrl == null) return NotFound();
                return Ok(new { previewImageUrl = previewUrl });
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // DELETE /api/admin/destinations/{id}/images/{imageId}
        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteImageAsync(id, imageId, userId);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/destinations/{id}/analytics
        [HttpGet("{id}/analytics")]
        public IActionResult GetAnalytics(Guid id)
        {
            return Ok(new
            {
                views         = 0,
                reviewCount   = 0,
                queuePending  = 0,
                queueApproved = 0
            });
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }

    public record CreateTypeRequest(string Name);
}
