using Explorea.API.DTOs.Admin.Event;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;

        public AdminEventsController(
            IAdminEventService service,
            IAdminQueueService queueService,
            AppDbContext context,
            ICloudinaryService cloudinary)
        {
            _service      = service;
            _queueService = queueService;
            _context      = context;
            _cloudinary   = cloudinary;
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
            [FromQuery] List<string>? extraFilters,
            [FromQuery] string? sortBy = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(
                    search, destinationId, cityId, typeId, startFrom, startTo, extraFilters, page, pageSize, userId, sortBy);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/events/{id}
        [HttpGet("{id:guid}")]
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

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var restored = await _service.RestoreAsync(id, userId);
                if (!restored) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var userId = GetCurrentUserId();
            var stats = await _service.GetStatsDtoAsync(userId);
            return Ok(stats);
        }

        // GET /api/admin/events/deleted
        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted(
            [FromQuery] string? search,
            [FromQuery] Guid? destinationId,
            [FromQuery] int? cityId,
            [FromQuery] int? typeId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetDeletedAsync(
                    search,
                    destinationId,
                    cityId,
                    typeId,
                    page,
                    pageSize,
                    userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/events/{id}/images
        [HttpPost("{id}/images")]
        public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
        {
            try
            {
                var exists = await _context.Events
                    .IgnoreQueryFilters()
                    .AnyAsync(e => e.Id == id);

                if (!exists) return NotFound();

                var url = await _cloudinary.UploadLandscapeAsync(file, "explorea/events");

                var sortOrder = await _context.EventImages
                    .CountAsync(img => img.EventId == id);

                var image = new EventImage
                {
                    Id        = Guid.NewGuid(),
                    EventId   = id,
                    ImageUrl  = url,
                    SortOrder = sortOrder,
                    CreatedAt = DateTimeOffset.UtcNow,
                    CreatedBy = GetCurrentUserId(),
                };

                await _context.EventImages.AddAsync(image);
                await _context.SaveChangesAsync();

                return Ok(new { id = image.Id, imageUrl = url, sortOrder = image.SortOrder });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        // PUT /api/admin/events/{id}/images/{imageId}/hero
        [HttpPut("{id}/images/{imageId}/hero")]
        public async Task<IActionResult> SetHeroImage(Guid id, Guid imageId)
        {
            try
            {
                var images = await _context.EventImages
                    .Where(i => i.EventId == id)
                    .OrderBy(i => i.SortOrder)
                    .ToListAsync();

                var hero = images.FirstOrDefault(i => i.Id == imageId);
                if (hero == null) return NotFound();

                hero.SortOrder = 0;
                var others = images.Where(i => i.Id != imageId).ToList();
                for (int i = 0; i < others.Count; i++)
                    others[i].SortOrder = i + 1;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        // DELETE /api/admin/events/{id}/images/{imageId}
        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
        {
            try
            {
                var image = await _context.EventImages
                    .FirstOrDefaultAsync(i => i.Id == imageId && i.EventId == id);

                if (image == null) return NotFound();

                _context.EventImages.Remove(image);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("{id}/reviews")]
        public async Task<IActionResult> GetReviews(Guid id)
        {
            var reviews = await _context.Reviews
                .Where(r => r.EntityType == "event" && r.EntityId == id)
                .Include(r => r.User)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .Select(r => new
                {
                    authorName = r.User.FirstName + " " + r.User.LastName,
                    authorAvatarUrl = r.User.ProfileImageUrl,
                    rating = (int)r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                })
                .ToListAsync();
            return Ok(reviews);
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
