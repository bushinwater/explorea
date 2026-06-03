using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/appeals")]
    public class AppealsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AppealsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] SubmitAppealDto dto)
        {
            var user = await _db.Users.FindAsync(dto.UserId);

            if (user == null || user.DeletedAt == null)
                return BadRequest(new { message = "Invalid request." });

            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            if (user.DeletedAt < cutoff)
                return BadRequest(new { message = "The appeal window has expired." });

            var alreadySubmitted = await _db.AccountAppeals
                .AnyAsync(a => a.UserId == dto.UserId && a.Status == "pending");

            if (alreadySubmitted)
                return Conflict(new { message = "An appeal has already been submitted for this account." });

            var appeal = new AccountAppeal
            {
                UserId = dto.UserId,
                Email = user.Email,
                FirstName = user.FirstName,
                Message = dto.Message?.Trim(),
                Status = "pending",
                CreatedAt = DateTimeOffset.UtcNow,
            };

            _db.AccountAppeals.Add(appeal);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Appeal submitted successfully." });
        }

        [HttpGet("check/{userId}")]
        public async Task<IActionResult> Check(Guid userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null || user.DeletedAt == null)
                return NotFound();

            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            if (user.DeletedAt < cutoff)
                return Ok(new { canAppeal = false, alreadySubmitted = false });

            var existing = await _db.AccountAppeals
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Status == "pending");

            return Ok(new
            {
                canAppeal = true,
                alreadySubmitted = existing != null,
                firstName = user.FirstName,
            });
        }
    }
}
