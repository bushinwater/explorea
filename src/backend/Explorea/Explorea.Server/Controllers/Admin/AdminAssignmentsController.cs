using Explorea.API.DTOs.Admin.Assignment;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/assignments")]
    [Authorize]
    public class AdminAssignmentsController : ControllerBase
    {
        private readonly IAdminAssignmentService _service;

        public AdminAssignmentsController(IAdminAssignmentService service)
        {
            _service = service;
        }

        // GET /api/admin/assignments?userId=
        [HttpGet]
        public async Task<IActionResult> GetByUser([FromQuery] Guid userId)
        {
            var items = await _service.GetByUserIdAsync(userId);
            return Ok(items);
        }

        // POST /api/admin/assignments
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateAssignmentDto dto)
        {
            try
            {
                var assignedBy = GetCurrentUserId();
                var created = await _service.CreateAsync(dto, assignedBy);
                return StatusCode(201, created);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // DELETE /api/admin/assignments/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _service.DeleteAsync(id, userId);
                return NoContent();
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
