using Explorea.API.DTOs.User;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IUserRepository _userRepo;

        public UsersController(AppDbContext db, IUserRepository userRepo)
        {
            _db = db;
            _userRepo = userRepo;
        }

        [HttpGet("me")]
        public IActionResult GetMe() => Ok();

        [HttpPut("me")]
        public IActionResult Update() => Ok();

        [HttpPut("me/preferences")]
        public IActionResult UpdatePreferences() => Ok();

        [Authorize]
        [HttpGet("me/interests")]
        public async Task<IActionResult> GetInterests()
        {
            try
            {
                var userId = await GetCurrentUserId();
                var tags = await _userRepo.GetInterestsAsync(userId);
                return Ok(tags.Select(t => new { t.Id, t.Name, t.Icon }));
            }
            catch { return Unauthorized(); }
        }

        [Authorize]
        [HttpPost("me/interests")]
        public async Task<IActionResult> UpdateInterests([FromBody] UpdateInterestsDto dto)
        {
            try
            {
                var userId = await GetCurrentUserId();
                await _userRepo.UpdateInterestsAsync(userId, dto.InterestTagIds);
                return NoContent();
            }
            catch { return Unauthorized(); }
        }

        [Authorize]
        [HttpPut("me/location")]
        public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationDto dto)
        {
            try
            {
                var userId = await GetCurrentUserId();
                var user = await _db.Users.FindAsync(userId);
                if (user == null) return NotFound();

                user.CurrentLatitude = dto.Lat;
                user.CurrentLongitude = dto.Lng;
                user.UpdatedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();

                return NoContent();
            }
            catch
            {
                return Unauthorized();
            }
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
