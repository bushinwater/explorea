using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/saved")]
    [Authorize]
    public class SavedItemsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavedItemsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("check")]
        public async Task<IActionResult> Check([FromQuery] string entityType, [FromQuery] Guid entityId)
        {
            var userId = await GetCurrentUserId();
            var exists = await _context.SavedItems
                .AnyAsync(s => s.UserId == userId && s.EntityType == entityType && s.EntityId == entityId);
            return Ok(new { isSaved = exists });
        }

        [HttpPost]
        public async Task<IActionResult> Save([FromBody] SaveItemRequest request)
        {
            var userId = await GetCurrentUserId();

            var alreadyExists = await _context.SavedItems
                .AnyAsync(s => s.UserId == userId && s.EntityType == request.EntityType && s.EntityId == request.EntityId);

            if (alreadyExists)
                return Conflict(new { message = "Already saved." });

            var item = new SavedItem
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = request.EntityType,
                EntityId = request.EntityId,
                SavedAt = DateTimeOffset.UtcNow,
                CreatedBy = userId
            };

            _context.SavedItems.Add(item);
            await _context.SaveChangesAsync();
            return StatusCode(201);
        }

        [HttpDelete("{entityType}/{entityId}")]
        public async Task<IActionResult> Delete(string entityType, Guid entityId)
        {
            var userId = await GetCurrentUserId();

            var item = await _context.SavedItems
                .FirstOrDefaultAsync(s => s.UserId == userId && s.EntityType == entityType && s.EntityId == entityId);

            if (item == null)
                return NotFound();

            _context.SavedItems.Remove(item);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<Guid> GetCurrentUserId()
        {
            var email = User.FindFirstValue(ClaimTypes.Email)
                     ?? User.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email claim not found in token.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                throw new Exception("User not found.");

            return user.Id;
        }
    }

    public class SaveItemRequest
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
    }
}
