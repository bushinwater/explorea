using Microsoft.AspNetCore.Mvc;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Explorea.API.DTOs.Admin.Activity;
using Explorea.API.Models;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/activities")]
    public class AdminActivitiesController : ControllerBase
    {
        private readonly IAdminActivityService _service;
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;

        public AdminActivitiesController(IAdminActivityService service, AppDbContext context, ICloudinaryService cloudinary)
        {
            _service = service;
            _context = context;
            _cloudinary = cloudinary;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] AdminActivityListQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(query, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted([FromQuery] AdminActivityListQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetDeletedAsync(query, userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions()
        {
            try
            {
                var userId = GetCurrentUserId();
                var options = await _service.GetFilterOptionsAsync(userId);
                return Ok(options);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _context.ActivityCategories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new { id = c.Id, name = c.Name })
                .ToListAsync();

            return Ok(categories);
        }

        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "Name is required." });

            var now = DateTimeOffset.UtcNow;
            var cat = new ActivityCategory { Name = req.Name.Trim(), CreatedAt = now, UpdatedAt = now };
            _context.ActivityCategories.Add(cat);
            await _context.SaveChangesAsync();
            return Ok(new { id = cat.Id, name = cat.Name });
        }

        public record CreateCategoryRequest(string Name);

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
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET /api/admin/activities/{id}/analytics
        [HttpGet("{id}/analytics")]
        public async Task<IActionResult> GetAnalytics(Guid id)
        {
            var now      = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);

            // 30-day views timeline
            var clickDates = await _context.PopularityLogs
                .Where(l => l.EntityType == "activity" && l.EntityId == id
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
                .CountAsync(l => l.EntityType == "activity" && l.EntityId == id && l.Source == "click");
            var viewsLast30 = clickDates.Count;

            var savedByUsers = await _context.SavedItems
                .Where(s => s.EntityType == "activity" && s.EntityId == id)
                .Select(s => s.UserId)
                .Distinct()
                .CountAsync();

            var planRaw = await _context.TripPlanItems
                .Where(t => t.EntityType == "activity" && t.EntityId == id)
                .Select(t => new
                {
                    UserId    = t.TripPlan.UserId,
                    PlannedAt = t.PlannedAt,
                    CreatedAt = t.CreatedAt,
                })
                .ToListAsync();
            var plannerByUsers = planRaw.Select(p => p.UserId).Distinct().Count();

            // Top planner month — when do users plan this activity
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

            // Reviews
            var reviewStats = await _context.Reviews
                .Where(r => r.EntityType == "activity" && r.EntityId == id && !r.IsDeleted && !r.IsHidden)
                .Select(r => (decimal?)r.Rating)
                .ToListAsync();
            var reviewCount = reviewStats.Count;
            decimal avgRating = reviewCount > 0 ? Math.Round(reviewStats.Average() ?? 0, 2) : 0;

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
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateActivityDto dto)
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
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateActivityDto dto)
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
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id}/images")]
        public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
        {
            try
            {
                var exists = await _context.Activities
                    .IgnoreQueryFilters()
                    .AnyAsync(a => a.Id == id);

                if (!exists) return NotFound();

                var url = await _cloudinary.UploadLandscapeAsync(file, "explorea/activities");

                var sortOrder = await _context.ActivityImages
                    .CountAsync(img => img.ActivityId == id);

                var image = new ActivityImage
                {
                    Id         = Guid.NewGuid(),
                    ActivityId = id,
                    ImageUrl   = url,
                    SortOrder  = sortOrder,
                    CreatedAt  = DateTimeOffset.UtcNow,
                    CreatedBy  = GetCurrentUserId(),
                };

                await _context.ActivityImages.AddAsync(image);
                await _context.SaveChangesAsync();

                return Ok(new { url, id = image.Id });
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
                var images = await _context.ActivityImages
                    .Where(i => i.ActivityId == id)
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

        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
        {
            try
            {
                var image = await _context.ActivityImages
                    .FirstOrDefaultAsync(i => i.Id == imageId && i.ActivityId == id);

                if (image == null) return NotFound();

                _context.ActivityImages.Remove(image);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

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
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(claim))
                return Guid.Empty;

            return Guid.Parse(claim);
        }
    }
}
