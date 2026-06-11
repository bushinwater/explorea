using Explorea.API.DTOs.Review;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    public class ReplyReviewDto
    {
        public string Reply { get; set; } = null!;
    }


    [ApiController]
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        private const int MaxImagesPerReview = 5;
        private const long MaxImageBytes = 5L * 1024 * 1024;
        private static readonly string[] AllowedImageContentTypes =
        {
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"
        };

        private readonly AppDbContext _db;
        private readonly ICloudinaryService _cloudinary;

        public ReviewsController(AppDbContext db, ICloudinaryService cloudinary)
        {
            _db = db;
            _cloudinary = cloudinary;
        }

        [HttpPost("images")]
        [Authorize]
        [RequestSizeLimit(40 * 1024 * 1024)]
        public async Task<IActionResult> UploadImages([FromForm] IFormFileCollection files)
        {
            if (files == null || files.Count == 0)
                return BadRequest(new { message = "Nije priložen nijedan fajl." });

            if (files.Count > MaxImagesPerReview)
                return BadRequest(new { message = $"Maksimalno {MaxImagesPerReview} slika po recenziji." });

            var urls = new List<string>();
            foreach (var file in files)
            {
                if (file.Length == 0)
                    return BadRequest(new { message = $"Fajl \"{file.FileName}\" je prazan." });
                if (file.Length > MaxImageBytes)
                    return BadRequest(new { message = $"Fajl \"{file.FileName}\" je veći od 5MB." });

                var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
                if (!AllowedImageContentTypes.Contains(contentType))
                    return BadRequest(new { message = $"Fajl \"{file.FileName}\" nije slika (dozvoljeni formati: JPG, PNG, WEBP, GIF, HEIC)." });

                var url = await _cloudinary.UploadReviewImageAsync(file, "explorea/reviews");
                urls.Add(url);
            }

            return Ok(new { urls });
        }

        [HttpGet("check")]
        [Authorize]
        public async Task<IActionResult> Check([FromQuery] string entityType, [FromQuery] Guid entityId)
        {
            var userId = await GetCurrentUserId();
            var exists = await _db.Reviews
                .AnyAsync(r => r.UserId == userId && r.EntityType == entityType && r.EntityId == entityId);
            return Ok(new { hasReviewed = exists });
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateReviewDto dto)
        {
            var userId = await GetCurrentUserId();

            var already = await _db.Reviews
                .AnyAsync(r => r.UserId == userId && r.EntityType == dto.EntityType && r.EntityId == dto.EntityId);

            if (already)
                return Conflict(new { message = "You have already reviewed this." });

            var imageUrls = (dto.ImageUrls ?? new List<string>())
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Take(MaxImagesPerReview)
                .ToList();

            if ((dto.ImageUrls?.Count ?? 0) > MaxImagesPerReview)
                return BadRequest(new { message = $"Maksimalno {MaxImagesPerReview} slika po recenziji." });

            var review = new Review
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = dto.EntityType,
                EntityId = dto.EntityId,
                Rating = (short)dto.Rating,
                Comment = dto.Comment,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                CreatedBy = userId,
                UpdatedBy = userId
            };

            _db.Reviews.Add(review);

            for (var i = 0; i < imageUrls.Count; i++)
            {
                _db.ReviewImages.Add(new ReviewImage
                {
                    Id = Guid.NewGuid(),
                    ReviewId = review.Id,
                    ImageUrl = imageUrls[i],
                    SortOrder = i,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            await _db.SaveChangesAsync();

            var created = await _db.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .FirstAsync(r => r.Id == review.Id);

            try { await UpdateAvgRating(dto.EntityType, dto.EntityId); } catch { /* non-fatal */ }

            return StatusCode(201, new ReviewDto
            {
                Id = created.Id,
                Rating = created.Rating,
                Comment = created.Comment,
                CreatedAt = created.CreatedAt,
                User = new ReviewUserDto
                {
                    Id = created.User.Id,
                    FirstName = created.User.FirstName,
                    LastName = created.User.LastName,
                    TravelerRank = created.User.TravelerRank,
                    ProfileImageUrl = created.User.ProfileImageUrl
                },
                Images = created.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ReviewImageDto { Id = i.Id, ImageUrl = i.ImageUrl, SortOrder = i.SortOrder })
                    .ToList()
            });
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReviewDto dto)
        {
            var userId = await GetCurrentUserId();
            var review = await _db.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

            if (review == null) return NotFound();

            review.Rating = (short)dto.Rating;
            review.Comment = dto.Comment;
            review.UpdatedAt = DateTimeOffset.UtcNow;
            review.UpdatedBy = userId;

            // Replace images if client sent an image list.
            if (dto.ImageUrls != null)
            {
                if (dto.ImageUrls.Count > MaxImagesPerReview)
                    return BadRequest(new { message = $"Maksimalno {MaxImagesPerReview} slika po recenziji." });

                _db.ReviewImages.RemoveRange(review.Images);

                var newUrls = dto.ImageUrls.Where(u => !string.IsNullOrWhiteSpace(u)).ToList();
                for (var i = 0; i < newUrls.Count; i++)
                {
                    _db.ReviewImages.Add(new ReviewImage
                    {
                        Id = Guid.NewGuid(),
                        ReviewId = review.Id,
                        ImageUrl = newUrls[i],
                        SortOrder = i,
                        CreatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            await _db.SaveChangesAsync();

            try { await UpdateAvgRating(review.EntityType, review.EntityId); } catch { /* non-fatal */ }

            var refreshed = await _db.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .FirstAsync(r => r.Id == review.Id);

            return Ok(new ReviewDto
            {
                Id = refreshed.Id,
                Rating = refreshed.Rating,
                Comment = refreshed.Comment,
                CreatedAt = refreshed.CreatedAt,
                User = new ReviewUserDto
                {
                    Id = refreshed.User.Id,
                    FirstName = refreshed.User.FirstName,
                    LastName = refreshed.User.LastName,
                    TravelerRank = refreshed.User.TravelerRank,
                    ProfileImageUrl = refreshed.User.ProfileImageUrl
                },
                Images = refreshed.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ReviewImageDto { Id = i.Id, ImageUrl = i.ImageUrl, SortOrder = i.SortOrder })
                    .ToList()
            });
        }

        [HttpPost("{id}/reply")]
        [Authorize]
        public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyReviewDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Reply))
                return BadRequest(new { message = "Odgovor ne sme biti prazan." });

            var userId = await GetCurrentUserId();
            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return Unauthorized();
            if (user.Role.Name != RoleNames.PlaceOwner)
                return StatusCode(403, new { message = "Samo vlasnik objekta može da odgovori na recenziju." });

            var review = await _db.Reviews
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Id == id && (r.EntityType == "place" || r.EntityType == "event") && !r.IsDeleted);

            if (review == null) return NotFound();

            var ownerPlaceIds = _db.Places.IgnoreQueryFilters()
                .Where(p => p.CreatedBy == userId)
                .Select(p => p.Id);

            bool isOwner = review.EntityType == "place"
                ? await ownerPlaceIds.ContainsAsync(review.EntityId)
                : await _db.Events.IgnoreQueryFilters()
                    .AnyAsync(e =>
                        e.Id == review.EntityId &&
                        (e.CreatedBy == userId ||
                         (e.PlaceId.HasValue && ownerPlaceIds.Contains(e.PlaceId.Value))));

            if (!isOwner)
                return StatusCode(403, new { message = "Možete odgovarati samo na recenzije vaših objekata ili događaja." });

            review.OwnerReply   = dto.Reply.Trim();
            review.OwnerReplyAt = DateTimeOffset.UtcNow;
            review.UpdatedAt = DateTimeOffset.UtcNow;
            review.UpdatedBy = userId;
            await _db.SaveChangesAsync();

            return Ok(new { ownerReply = review.OwnerReply, ownerReplyAt = review.OwnerReplyAt });
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(Guid id)
        {
            var userId = await GetCurrentUserId();
            var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (review == null) return NotFound();

            var entityType = review.EntityType;
            var entityId = review.EntityId;

            _db.Reviews.Remove(review);
            await _db.SaveChangesAsync();

            await UpdateAvgRating(entityType, entityId);

            return NoContent();
        }

        private async Task UpdateAvgRating(string entityType, Guid entityId)
        {
            var avg = await _db.Reviews
                .Where(r => r.EntityType == entityType && r.EntityId == entityId)
                .AverageAsync(r => (double?)r.Rating) ?? 0;

            var rounded = (decimal)Math.Round(avg, 1);

            if (entityType == "activity")
            {
                var entity = await _db.Activities.FindAsync(entityId);
                if (entity != null) entity.AvgRating = rounded;
            }
            else if (entityType == "destination")
            {
                var entity = await _db.Destinations.FindAsync(entityId);
                if (entity != null) entity.AvgRating = rounded;
            }
            else if (entityType == "event")
            {
                var entity = await _db.Events.FindAsync(entityId);
                if (entity != null) entity.AvgRating = rounded;
            }

            await _db.SaveChangesAsync();
        }

        private async Task<Guid> GetCurrentUserId()
        {
            var email = User.FindFirstValue(ClaimTypes.Email)
                     ?? User.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email claim not found in token.");

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                throw new Exception("User not found.");

            return user.Id;
        }
    }
}
