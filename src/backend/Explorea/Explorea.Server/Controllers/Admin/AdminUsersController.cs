using Explorea.API.DTOs.Admin.User;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/users")]
    [Authorize]
    public class AdminUsersController : ControllerBase
    {
        private readonly IAdminUserService _service;
        private readonly ICloudinaryService _cloudinary;
        private readonly AppDbContext _db;

        public AdminUsersController(IAdminUserService service, ICloudinaryService cloudinary, AppDbContext db)
        {
            _service = service;
            _cloudinary = cloudinary;
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] AdminUserDirectoryQueryDto query)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var (items, total) = await _service.GetDirectoryAsync(query, currentUserId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var stats = await _service.GetStatsAsync(currentUserId);
                return Ok(stats);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("regions")]
        public async Task<IActionResult> GetRegions()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var regions = await _service.GetRegionsAsync(currentUserId);
                return Ok(regions);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateUserDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var created = await _service.CreateAsync(dto, currentUserId);
                return StatusCode(201, created);
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

        [HttpPut("{id}/status")]
        public async Task<IActionResult> SetStatus(Guid id, [FromBody] AdminSetUserStatusDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var updated = await _service.SetStatusAsync(id, dto, currentUserId);
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

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateUserDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var updated = await _service.UpdateAsync(id, dto, currentUserId);
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
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var (items, total) = await _service.GetDeletedDirectoryAsync(page, pageSize, currentUserId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(Guid id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                await _service.RestoreAsync(id, currentUserId);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost("{id}/avatar")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<IActionResult> UploadAvatar(Guid id, IFormFile file)
        {
            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "Image must be under 5 MB." });

            var user = await _db.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found." });

            var url = await _cloudinary.UploadImageAsync(file, "explorea/avatars");
            user.ProfileImageUrl = url;
            await _db.SaveChangesAsync();

            return Ok(new { avatarUrl = url });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                await _service.DeleteAsync(id, currentUserId);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
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
