using System.Security.Claims;
using Explorea.API.DTOs.Review;
using Explorea.API.DTOs.User;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/profile")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService _profileService;

        public ProfileController(IProfileService profileService)
        {
            _profileService = profileService;
        }

        [HttpGet("saved")]
        public async Task<IActionResult> GetSavedItems()
        {
            var userId = GetCurrentUserId();
            var result = await _profileService.GetSavedItemsAsync(userId);
            return Ok(result);
        }

        [HttpPost("saved")]
        public async Task<IActionResult> SaveItem([FromBody] SavedItemRequestDto dto)
        {
            var userId = GetCurrentUserId();
            await _profileService.SaveItemAsync(userId, dto);
            return StatusCode(201);
        }

        [HttpDelete("saved")]
        public async Task<IActionResult> RemoveSavedItem([FromQuery] string entityType, [FromQuery] Guid entityId)
        {
            var userId = GetCurrentUserId();
            await _profileService.RemoveSavedItemAsync(userId, entityType, entityId);
            return NoContent();
        }

        [HttpGet("reviews")]
        public async Task<IActionResult> GetMyReviews()
        {
            var userId = GetCurrentUserId();
            var result = await _profileService.GetMyReviewsAsync(userId);
            return Ok(result);
        }

        [HttpPost("reviews")]
        public async Task<IActionResult> AddReview([FromBody] CreateReviewDto dto)
        {
            var userId = GetCurrentUserId();
            var result = await _profileService.AddReviewAsync(userId, dto);
            return Ok(result);
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userIdClaim))
                throw new Exception("User id claim not found.");

            return Guid.Parse(userIdClaim);
        }
    }
}