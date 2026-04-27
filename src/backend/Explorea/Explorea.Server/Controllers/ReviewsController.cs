using Explorea.API.DTOs.Review;
using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ReviewsController(AppDbContext db)
        {
            _db = db;
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
            await _db.SaveChangesAsync();

            var created = await _db.Reviews
                .Include(r => r.User)
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
                }
            });
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
