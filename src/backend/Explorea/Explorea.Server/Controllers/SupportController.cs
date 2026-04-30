using System.Security.Claims;
using Explorea.API.DTOs.Support;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/support/tickets")]
    [Authorize]
    public class SupportController : ControllerBase
    {
        private readonly IUserSupportService _supportService;

        public SupportController(IUserSupportService supportService)
        {
            _supportService = supportService;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSupportTicketDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _supportService.CreateTicketAsync(userId, dto);
                return StatusCode(201, created);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMine([FromQuery] SupportTicketQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _supportService.GetMineAsync(userId, query);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var userId = GetCurrentUserId();
            var ticket = await _supportService.GetByIdAsync(userId, id);

            if (ticket == null)
                return NotFound(new { message = "Support ticket was not found." });

            return Ok(ticket);
        }

        [HttpPost("{id:guid}/messages")]
        public async Task<IActionResult> AddMessage(Guid id, [FromBody] CreateSupportMessageDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _supportService.AddMessageAsync(userId, id, dto);
                return StatusCode(201, created);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(claim) || !Guid.TryParse(claim, out var userId))
                throw new UnauthorizedAccessException("Authenticated user id was not found.");

            return userId;
        }
    }
}
