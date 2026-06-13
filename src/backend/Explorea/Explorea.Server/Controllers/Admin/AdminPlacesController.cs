using System.Security.Claims;
using Explorea.API.DTOs.Admin;
using Explorea.API.DTOs.Admin.Place;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/places")]
    [Authorize]
    public class AdminPlacesController : ControllerBase
    {
        private readonly IAdminPlaceService _placeService;
        private readonly IAdminQueueService _queueService;
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;

        public AdminPlacesController(
            IAdminPlaceService placeService,
            IAdminQueueService queueService,
            AppDbContext context,
            ICloudinaryService cloudinary)
        {
            _placeService = placeService;
            _queueService = queueService;
            _context = context;
            _cloudinary = cloudinary;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] AdminPlaceListQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _placeService.GetAllAsync(query, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var userId = GetCurrentUserId();
                var stats = await _placeService.GetStatsAsync(userId);
                return Ok(stats);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted([FromQuery] AdminPlaceListQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _placeService.GetDeletedAsync(query, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("amenities")]
        public async Task<IActionResult> GetAmenities([FromQuery] int? typeId)
        {
            var amenities = await _context.PlaceAmenities
                .AsNoTracking()
                .OrderBy(a => a.Name)
                .Select(a => new { id = a.Id, name = a.Name })
                .ToListAsync();

            return Ok(amenities);
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyPlaces()
        {
            try
            {
                var userId = GetCurrentUserId();
                var items = await _placeService.GetMyPlacesAsync(userId);
                return Ok(items);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id, [FromQuery] bool venueLookup = false)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _placeService.GetByIdAsync(id, userId, venueLookup);
                if (result == null) return NotFound();
                if (!venueLookup) result.Documents = await GetOwnerDocumentsAsync("place", id);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreatePlaceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _placeService.CreateAsync(dto, userId);
                return StatusCode(201, created);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpPost("request")]
        public async Task<IActionResult> SubmitPlaceRequest([FromBody] SubmitPlaceRequestDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _placeService.SubmitPlaceRequestAsync(dto, userId);
                return StatusCode(201, new { message = "Place request submitted successfully." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdatePlaceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _placeService.UpdateAsync(id, dto, userId);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("{id}/dependencies")]
        public async Task<IActionResult> GetDependencies(
            Guid id,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var result = await _placeService.GetDependenciesAsync(id, page, pageSize);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _placeService.DeleteAsync(id, userId);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpDelete("{id}/cascade")]
        public async Task<IActionResult> DeleteCascade(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _placeService.DeleteCascadeAsync(id, userId);
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
                var restored = await _placeService.RestoreAsync(id, userId);
                if (!restored) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("{id}/reviews")]
        public async Task<IActionResult> GetReviews(Guid id)
        {
            var reviews = await _context.Reviews
                .Where(r => r.EntityType == "place" && r.EntityId == id)
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

        // GET /api/admin/places/{id}/analytics
        [HttpGet("{id}/analytics")]
        public async Task<IActionResult> GetAnalytics(Guid id)
        {
            var now      = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);

            // 30-day views timeline
            var clickDates = await _context.PopularityLogs
                .Where(l => l.EntityType == "place" && l.EntityId == id
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
                .CountAsync(l => l.EntityType == "place" && l.EntityId == id && l.Source == "click");
            var viewsLast30 = clickDates.Count;

            var savedByUsers = await _context.SavedItems
                .Where(s => s.EntityType == "place" && s.EntityId == id)
                .Select(s => s.UserId)
                .Distinct()
                .CountAsync();

            var planRaw = await _context.TripPlanItems
                .Where(t => t.EntityType == "place" && t.EntityId == id)
                .Select(t => new
                {
                    UserId    = t.TripPlan.UserId,
                    PlannedAt = t.PlannedAt,
                    CreatedAt = t.CreatedAt,
                })
                .ToListAsync();
            var plannerByUsers = planRaw.Select(p => p.UserId).Distinct().Count();

            // Top planner month
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

            // Avg rating + review count
            var reviewStats = await _context.Reviews
                .Where(r => r.EntityType == "place" && r.EntityId == id && !r.IsDeleted && !r.IsHidden)
                .Select(r => (decimal?)r.Rating)
                .ToListAsync();
            var reviewCount = reviewStats.Count;
            decimal avgRating = reviewCount > 0 ? Math.Round(reviewStats.Average() ?? 0, 2) : 0;

            // Events hosted at this place
            var eventCount = await _context.Events
                .IgnoreQueryFilters()
                .CountAsync(e => !e.IsDeleted && e.PlaceId == id);
            var upcomingEventCount = await _context.Events
                .IgnoreQueryFilters()
                .CountAsync(e => !e.IsDeleted && e.PlaceId == id && e.StartDatetime >= now);

            return Ok(new
            {
                totalViews,
                viewsLast30,
                viewsTimeline = timeline,
                savedByUsers,
                plannerByUsers,
                topPlannerMonth,
                topPlannerMonthCount,
                reviewCount,
                avgRating,
                eventCount,
                upcomingEventCount,
            });
        }

        [HttpPost("{id}/images")]
        public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
        {
            try
            {
                var exists = await _context.Places.AnyAsync(p => p.Id == id);
                if (!exists) return NotFound();

                var url = await _cloudinary.UploadLandscapeAsync(file, "explorea/places");

                var sortOrder = await _context.PlaceImages.CountAsync(img => img.PlaceId == id);

                var image = new PlaceImage
                {
                    Id = Guid.NewGuid(),
                    PlaceId = id,
                    ImageUrl = url,
                    SortOrder = sortOrder,
                    CreatedAt = DateTimeOffset.UtcNow,
                    CreatedBy = GetCurrentUserId(),
                    UpdatedBy = GetCurrentUserId()
                };

                await _context.PlaceImages.AddAsync(image);
                await _context.SaveChangesAsync();

                return Ok(new { id = image.Id, url, sortOrder = image.SortOrder });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpPut("{id}/images/{imageId}/hero")]
        public async Task<IActionResult> SetHeroImage(Guid id, Guid imageId)
        {
            try
            {
                var images = await _context.PlaceImages
                    .Where(i => i.PlaceId == id)
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

        [HttpPut("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var queueItem = await _context.SubmissionQueue
                    .FirstOrDefaultAsync(q =>
                        q.EntityType == "place" &&
                        q.EntityId == id &&
                        q.Status == "Pending");

                if (queueItem == null) return NotFound(new { message = "Pending place request not found." });

                await _queueService.ApproveByTOAsync(queueItem.Id, userId);
                return NoContent();
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

        [HttpPut("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] RejectPlaceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var queueItem = await _context.SubmissionQueue
                    .FirstOrDefaultAsync(q =>
                        q.EntityType == "place" &&
                        q.EntityId == id &&
                        q.Status == "Pending");

                if (queueItem == null) return NotFound(new { message = "Pending place request not found." });

                await _queueService.RejectByTOAsync(
                    queueItem.Id,
                    userId,
                    string.IsNullOrWhiteSpace(dto.Reason)
                        ? "Zahtev za objekat je odbijen od strane administratora."
                        : dto.Reason.Trim());

                return NoContent();
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

        [HttpPost("{id}/documents")]
        public async Task<IActionResult> UploadDocument(Guid id, [FromForm] IFormFile file, [FromForm] string documentType)
        {
            try
            {
                var userId = GetCurrentUserId();
                var place = await _context.Places
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (place == null) return NotFound();

                var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId);
                if (user?.Role.Name != RoleNames.PlaceOwner)
                    return StatusCode(403, new { message = "Access denied." });

                if (place.CreatedBy != userId)
                    return StatusCode(403, new { message = "Mozete dodavati dokumente samo za svoje objekte." });

                var document = await UploadOwnerDocumentAsync("place", id, userId, file, documentType);
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

        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
        {
            try
            {
                var image = await _context.PlaceImages
                    .FirstOrDefaultAsync(i => i.Id == imageId && i.PlaceId == id);

                if (image == null) return NotFound();

                _context.PlaceImages.Remove(image);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
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

        private static string NormalizeDocumentType(string? documentType)
        {
            var value = documentType?.Trim().ToLowerInvariant();
            return value is "identity" or "authorization" or "license" or "other"
                ? value
                : "other";
        }

        private async Task<List<OwnerSubmissionDocumentDto>> GetOwnerDocumentsAsync(string entityType, Guid entityId)
        {
            return await _context.OwnerSubmissionDocuments
                .Where(document => document.EntityType == entityType && document.EntityId == entityId)
                .OrderBy(document => document.CreatedAt)
                .Select(document => new OwnerSubmissionDocumentDto
                {
                    Id = document.Id,
                    DocumentType = document.DocumentType,
                    DocumentUrl = BuildDocumentDeliveryUrl(document.DocumentUrl),
                    FileName = document.FileName,
                    ContentType = document.ContentType,
                    CreatedAt = document.CreatedAt
                })
                .ToListAsync();
        }

        private static string BuildDocumentDeliveryUrl(string url)
        {
            return url.Replace("/upload/fl_attachment/", "/upload/");
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }

    public class RejectPlaceDto
    {
        public string Reason { get; set; } = string.Empty;
    }
}
