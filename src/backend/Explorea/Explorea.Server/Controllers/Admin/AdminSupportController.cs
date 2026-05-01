using System.Security.Claims;
using Explorea.API.DTOs.Admin.Support;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/support/tickets")]
    [Authorize]
    public class AdminSupportController : ControllerBase
    {
        private readonly IAdminSupportService _service;

        public AdminSupportController(IAdminSupportService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetTickets([FromQuery] AdminSupportTicketQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.GetTicketsAsync(query, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var ticket = await _service.GetByIdAsync(id, userId);
                if (ticket == null)
                    return NotFound(new { message = "Support ticket was not found." });

                return Ok(ticket);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost("{id:guid}/messages")]
        public async Task<IActionResult> AddMessage(Guid id, [FromBody] AdminCreateSupportMessageDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _service.AddMessageAsync(id, dto, userId);
                return StatusCode(201, created);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:guid}/escalate")]
        public async Task<IActionResult> Escalate(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.EscalateAsync(id, userId);
                return Ok(updated);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("{id:guid}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] AdminUpdateSupportTicketStatusDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateStatusAsync(id, dto, userId);
                return Ok(updated);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }
    }
}
