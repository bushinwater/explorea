using Explorea.API.DTOs.User;
using Explorea.API.Models;
using Explorea.Server.Data;
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

        public UsersController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet("me")]
        public IActionResult GetMe() => Ok();

        [HttpPut("me")]
        public IActionResult Update() => Ok();

        [HttpPut("me/preferences")]
        public IActionResult UpdatePreferences() => Ok();

        [HttpGet("me/interests")]
        public IActionResult GetInterests() => Ok();

        [HttpPost("me/interests")]
        public IActionResult UpdateInterests() => Ok();

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
