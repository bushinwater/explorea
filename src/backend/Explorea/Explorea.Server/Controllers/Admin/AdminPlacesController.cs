using System.Security.Claims;
using Explorea.API.DTOs.Admin.Place;
using Explorea.API.Models;
using Explorea.Server.Data;
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
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;

        public AdminPlacesController(
            IAdminPlaceService placeService,
            AppDbContext context,
            ICloudinaryService cloudinary)
        {
            _placeService = placeService;
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
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _placeService.GetByIdAsync(id, userId);
                if (result == null) return NotFound();
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

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
