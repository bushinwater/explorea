using Explorea.API.DTOs.Admin;
using Explorea.API.DTOs.Admin.Event;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
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
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET /api/admin/events/rejected
        [HttpGet("rejected")]
        public async Task<IActionResult> GetRejected(
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
                var (items, total) = await _service.GetRejectedAsync(
                    search, destinationId, cityId, typeId, page, pageSize, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // PUT /api/admin/events/{id}/reactivate
        [HttpPut("{id:guid}/reactivate")]
        public async Task<IActionResult> Reactivate(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _service.ReactivateAsync(id, userId);
                return Ok();
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        // PUT /api/admin/events/{id}/reforward
        [HttpPut("{id:guid}/reforward")]
        public async Task<IActionResult> Reforward(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _service.ReforwardAsync(id, userId);
                return Ok();
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
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

        [HttpPost("{id}/renew")]
        public async Task<IActionResult> Renew(Guid id, [FromBody] AdminRenewEventDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var renewed = await _service.RenewAsync(id, dto, userId);
                if (renewed == null) return NotFound();
                return Ok(renewed);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
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

        [HttpGet("expired")]
        public async Task<IActionResult> GetExpired(
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
                var (items, total) = await _service.GetExpiredAsync(
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

        [HttpPost("{id}/documents")]
        public async Task<IActionResult> UploadDocument(Guid id, [FromForm] IFormFile file, [FromForm] string documentType)
        {
            try
            {
                var userId = GetCurrentUserId();
                var ev = await _context.Events
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (ev == null) return NotFound();

                var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId);
                if (user?.Role.Name != RoleNames.PlaceOwner)
                    return StatusCode(403, new { message = "Access denied." });

                var ownerPlaceIds = _context.Places
                    .IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == userId)
                    .Select(p => p.Id);

                var isOwnerEvent = ev.CreatedBy == userId ||
                    (ev.PlaceId.HasValue && await ownerPlaceIds.ContainsAsync(ev.PlaceId.Value));

                if (!isOwnerEvent)
                    return StatusCode(403, new { message = "Mozete dodavati dokumente samo za svoje dogadjaje." });

                var document = await UploadOwnerDocumentAsync("event", id, userId, file, documentType);
                return Ok(document);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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
                .Include(r => r.Images)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .Select(r => new
                {
                    id = r.Id,
                    authorName = r.User.FirstName + " " + r.User.LastName,
                    authorAvatarUrl = r.User.ProfileImageUrl,
                    rating = (int)r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                    imageUrls = r.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).ToList(),
                })
                .ToListAsync();
            return Ok(reviews);
        }

        // GET /api/admin/events/{id}/analytics
        [HttpGet("{id}/analytics")]
        public async Task<IActionResult> GetAnalytics(Guid id)
        {
            var now      = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);

            // 30-day visits timeline — materialize raw rows then bucket in memory
            // to avoid EF DateTimeOffset translation gotchas with groupings.
            var clickDates = await _context.PopularityLogs
                .Where(l => l.EntityType == "event" && l.EntityId == id
                            && l.Source == "click" && l.CreatedAt >= monthAgo)
                .Select(l => l.CreatedAt)
                .ToListAsync();
            var lookup = clickDates
                .GroupBy(d => d.UtcDateTime.Date)
                .ToDictionary(g => g.Key, g => g.Count());

            var timeline = new List<object>(31);
            for (var i = 30; i >= 0; i--)
            {
                var d = now.AddDays(-i).UtcDateTime.Date;
                timeline.Add(new
                {
                    date  = d.ToString("yyyy-MM-dd"),
                    value = lookup.GetValueOrDefault(d, 0),
                });
            }

            var totalViews = await _context.PopularityLogs
                .CountAsync(l => l.EntityType == "event" && l.EntityId == id && l.Source == "click");
            var viewsLast30 = clickDates.Count;

            var savedByUsers = await _context.SavedItems
                .Where(s => s.EntityType == "event" && s.EntityId == id)
                .Select(s => s.UserId)
                .Distinct()
                .CountAsync();

            // Pull TripPlanItems for this event into memory so all aggregations
            // (planner users, top month, top date) operate on the same materialized set.
            var planRaw = await _context.TripPlanItems
                .Where(t => t.EntityType == "event" && t.EntityId == id)
                .Select(t => new
                {
                    UserId    = t.TripPlan.UserId,
                    PlannedAt = t.PlannedAt,
                    CreatedAt = t.CreatedAt,
                })
                .ToListAsync();

            var plannerByUsers = planRaw.Select(p => p.UserId).Distinct().Count();

            // Determine if event spans multiple dates.
            var ev = await _context.Events
                .IgnoreQueryFilters()
                .Where(e => e.Id == id)
                .Select(e => new { e.StartDatetime, e.EndDatetime })
                .FirstOrDefaultAsync();
            var isMultiDay = ev != null && ev.StartDatetime.UtcDateTime.Date != ev.EndDatetime.UtcDateTime.Date;

            // Top planner month — bucket by (year, month) of PlannedAt ?? CreatedAt.
            string? topPlannerMonth = null;
            int topPlannerMonthCount = 0;
            var monthGroups = planRaw
                .Select(p => (p.PlannedAt ?? p.CreatedAt).UtcDateTime)
                .GroupBy(d => new { d.Year, d.Month })
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();
            if (monthGroups != null)
            {
                topPlannerMonth = $"{monthGroups.Key.Year}-{monthGroups.Key.Month:D2}";
                topPlannerMonthCount = monthGroups.Count();
            }

            // Top event date — only meaningful for multi-day events.
            string? topPlannerDate = null;
            int topPlannerDateCount = 0;
            if (isMultiDay)
            {
                var dateGroups = planRaw
                    .Where(p => p.PlannedAt.HasValue)
                    .GroupBy(p => p.PlannedAt!.Value.UtcDateTime.Date)
                    .Select(g => new { Date = g.Key, Users = g.Select(x => x.UserId).Distinct().Count() })
                    .OrderByDescending(g => g.Users)
                    .FirstOrDefault();
                if (dateGroups != null)
                {
                    topPlannerDate = dateGroups.Date.ToString("yyyy-MM-dd");
                    topPlannerDateCount = dateGroups.Users;
                }
            }

            return Ok(new
            {
                totalViews,
                viewsLast30,
                viewsTimeline = timeline,
                savedByUsers,
                plannerByUsers,
                topPlannerMonth,
                topPlannerMonthCount,
                isMultiDay,
                topPlannerDate,
                topPlannerDateCount,
            });
        }

        private async Task<OwnerSubmissionDocumentDto> UploadOwnerDocumentAsync(
            string entityType,
            Guid entityId,
            Guid userId,
            IFormFile file,
            string documentType)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Dokument je obavezan.");

            if (file.Length > 10 * 1024 * 1024)
                throw new ArgumentException("Dokument mora biti manji od 10 MB.");

            var allowedTypes = new[] { "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
                throw new ArgumentException("Dozvoljeni formati su: PDF, JPG, PNG, WebP.");

            var normalizedType = NormalizeDocumentType(documentType);
            var url = await _cloudinary.UploadRawAsync(file, $"explorea/owner-documents/{entityType}");

            var document = new OwnerSubmissionDocument
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = entityType,
                EntityId = entityId,
                DocumentType = normalizedType,
                DocumentUrl = url,
                FileName = file.FileName,
                ContentType = file.ContentType,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _context.OwnerSubmissionDocuments.AddAsync(document);
            await _context.SaveChangesAsync();

            return new OwnerSubmissionDocumentDto
            {
                Id = document.Id,
                DocumentType = document.DocumentType,
                DocumentUrl = BuildDocumentDeliveryUrl(document.DocumentUrl),
                FileName = document.FileName,
                ContentType = document.ContentType,
                CreatedAt = document.CreatedAt
            };
        }

        private static string BuildDocumentDeliveryUrl(string url)
        {
            return url.Replace("/upload/fl_attachment/", "/upload/");
        }

        private static string NormalizeDocumentType(string? documentType)
        {
            var value = documentType?.Trim().ToLowerInvariant();
            return value is "identity" or "authorization" or "license" or "other"
                ? value
                : "other";
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
