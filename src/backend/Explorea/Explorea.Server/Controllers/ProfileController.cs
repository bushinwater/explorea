using System.Security.Claims;
using Explorea.API.DTOs.Auth;
using Explorea.API.DTOs.Review;
using Explorea.API.DTOs.User;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/profile")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService _profileService;
        private readonly IUserRepository _userRepository;
        private readonly AppDbContext _db;
        private readonly JwtHelper _jwt;

        public ProfileController(IProfileService profileService, IUserRepository userRepository, AppDbContext db, JwtHelper jwt)
        {
            _profileService = profileService;
            _userRepository = userRepository;
            _db = db;
            _jwt = jwt;
        }

        [HttpGet("saved")]
        public async Task<IActionResult> GetSavedItems()
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.GetSavedItemsAsync(userId);
            return Ok(result);
        }

        [HttpPost("saved")]
        public async Task<IActionResult> SaveItem([FromBody] SavedItemRequestDto dto)
        {
            var userId = await GetCurrentUserId();
            await _profileService.SaveItemAsync(userId, dto);
            return StatusCode(201);
        }

        [HttpDelete("saved")]
        public async Task<IActionResult> RemoveSavedItem([FromQuery] string entityType, [FromQuery] Guid entityId)
        {
            var userId = await GetCurrentUserId();
            await _profileService.RemoveSavedItemAsync(userId, entityType, entityId);
            return NoContent();
        }

        [HttpGet("reviews")]
        public async Task<IActionResult> GetMyReviews()
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.GetMyReviewsAsync(userId);
            return Ok(result);
        }

        [HttpPost("reviews")]
        public async Task<IActionResult> AddReview([FromBody] CreateReviewDto dto)
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.AddReviewAsync(userId, dto);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.GetProfileAsync(userId);
            return Ok(result);
        }

        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateUserDto dto)
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.UpdateProfileAsync(userId, dto);
            return Ok(result);
        }

        [HttpPost("support")]
        public async Task<IActionResult> SendSupport([FromBody] SupportRequestDto dto)
        {
            var userId = await GetCurrentUserId();
            await _profileService.SendSupportAsync(userId, dto);
            return Ok(new { message = "Support query forwarded successfully." });
        }

        [HttpGet("for-you")]
        public async Task<IActionResult> GetForYou()
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.GetForYouAsync(userId);
            return Ok(result);
        }

        [HttpDelete("avatar")]
        public async Task<IActionResult> RemoveAvatar()
        {
            var userId = await GetCurrentUserId();
            await _profileService.RemoveAvatarAsync(userId);
            return NoContent();
        }

        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "File size must not exceed 5 MB." });

            var userId = await GetCurrentUserId();
            var url = await _profileService.UploadAvatarAsync(userId, file);
            return Ok(new { url });
        }

        [HttpPatch("newsletter")]
        public async Task<IActionResult> UpdateNewsletter([FromBody] UpdateNewsletterDto dto)
        {
            var userId = await GetCurrentUserId();
            var newsletter = await _profileService.UpdateNewsletterAsync(userId, dto.Newsletter);
            return Ok(new { newsletter });
        }

        [HttpPatch("complete")]
        public async Task<IActionResult> CompleteProfile([FromBody] CompleteProfileDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Gender))
                return BadRequest(new { message = "Gender is required." });

            if (!DateOnly.TryParse(dto.DateOfBirth, out var dob))
                return BadRequest(new { message = "Invalid date of birth." });

            var userId = await GetCurrentUserId();
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) return NotFound();

            user.Gender = dto.Gender;
            user.DateOfBirth = dob;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var userId = await GetCurrentUserId();
            var result = await _profileService.GetStatsAsync(userId);
            return Ok(result);
        }

        [HttpPost("upgrade-to-partner")]
        public async Task<IActionResult> UpgradeToPartner()
        {
            var userId = await GetCurrentUserId();
            var user = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            if (user.Role?.Name != "traveler")
                return BadRequest(new { message = "Only traveler accounts can be upgraded to partner." });

            var partnerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "place_owner");
            if (partnerRole == null) return StatusCode(500, new { message = "Partner role not configured." });

            user.RoleId  = partnerRole.Id;
            user.Role    = partnerRole;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();

            var accessToken  = _jwt.GenerateAccessToken(user);
            var rawRefresh   = _jwt.GenerateRefreshToken();
            var hashedRefresh = _jwt.HashToken(rawRefresh);

            var refreshExpiry = int.TryParse(
                System.Environment.GetEnvironmentVariable("JWT_REFRESH_EXPIRY_DAYS") ?? "30",
                out var days) ? days : 30;

            _db.RefreshTokens.Add(new RefreshToken
            {
                Id         = Guid.NewGuid(),
                UserId     = user.Id,
                TokenHash  = hashedRefresh,
                ExpiresAt  = DateTimeOffset.UtcNow.AddDays(refreshExpiry),
                CreatedAt  = DateTimeOffset.UtcNow,
                CreatedByIp = HttpContext.Connection.RemoteIpAddress,
                DeviceInfo  = Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null,
            });
            await _db.SaveChangesAsync();

            return Ok(new AuthResponseDto
            {
                AccessToken  = accessToken,
                RefreshToken = rawRefresh,
            });
        }

        private async Task<Guid> GetCurrentUserId()
        {
            // .NET JWT middleware may store the claim as the full URI (ClaimTypes.Email)
            // or as the short JWT name ("email") depending on MapInboundClaims setting
            var email = User.FindFirstValue(ClaimTypes.Email)
                     ?? User.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email claim not found in token.");

            var user = await _userRepository.GetByEmailAsync(email);

            if (user == null)
                throw new Exception("Authenticated user not found.");

            return user.Id;
        }
    }
}