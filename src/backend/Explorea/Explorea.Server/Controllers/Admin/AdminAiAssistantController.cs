using Explorea.API.DTOs.Admin.Ai;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/ai")]
    [Authorize(Roles = "super_admin,tourist_organization")]
    public class AdminAiAssistantController : ControllerBase
    {
        private readonly IAdminAiAssistantService _service;

        public AdminAiAssistantController(IAdminAiAssistantService service)
        {
            _service = service;
        }

        [HttpGet("insights")]
        public async Task<IActionResult> GetInsights()
        {
            try
            {
                var userId = GetCurrentUserId();
                var insights = await _service.GetInsightsAsync(userId);
                return Ok(insights);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AdminAiChatRequestDto request)
        {
            try
            {
                var userId = GetCurrentUserId();
                var response = await _service.ChatAsync(userId, request);
                return Ok(response);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
