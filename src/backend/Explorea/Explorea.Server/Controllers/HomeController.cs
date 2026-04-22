using Explorea.API.DTOs.Home;
using Explorea.Server.Data;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/home")]
    public class HomeController : ControllerBase
    {
        private readonly IHomeService _homeService;
        private readonly AppDbContext _db;

        public HomeController(IHomeService homeService, AppDbContext db)
        {
            _homeService = homeService;
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetHome([FromQuery] HomeQueryDto query)
        {
            try
            {
                var result = await _homeService.GetHomeDataAsync(query);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("recommendations")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRecommendations([FromQuery] double? userLat, [FromQuery] double? userLng)
        {
            Guid? userId = null;
            var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (!string.IsNullOrEmpty(email))
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                userId = user?.Id;
            }

            var result = await _homeService.GetRecommendationsAsync(userId, userLat, userLng);
            return Ok(result);
        }
    }
}
