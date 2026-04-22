using Explorea.Server.Data;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/popularity")]
    public class PopularityController : ControllerBase
    {
        private readonly IPopularityService _popularityService;
        private readonly AppDbContext _db;
        private const string SessionCookie = "pop_session";

        public PopularityController(IPopularityService popularityService, AppDbContext db)
        {
            _popularityService = popularityService;
            _db = db;
        }

        [HttpPost("track")]
        [AllowAnonymous]
        public async Task<IActionResult> Track([FromBody] TrackPopularityDto dto)
        {
            Guid? userId = null;
            string? sessionId = null;

            var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (!string.IsNullOrEmpty(email))
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                userId = user?.Id;
            }

            if (!userId.HasValue)
            {
                sessionId = Request.Cookies[SessionCookie];
                if (string.IsNullOrEmpty(sessionId))
                {
                    sessionId = Guid.NewGuid().ToString("N");
                    Response.Cookies.Append(SessionCookie, sessionId, new CookieOptions
                    {
                        HttpOnly = true,
                        SameSite = SameSiteMode.Lax,
                        Expires = DateTimeOffset.UtcNow.AddDays(2)
                    });
                }
            }

            await _popularityService.TrackClickAsync(dto.EntityType, dto.EntityId, userId, sessionId);
            return Ok();
        }
    }

    public class TrackPopularityDto
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
    }
}
