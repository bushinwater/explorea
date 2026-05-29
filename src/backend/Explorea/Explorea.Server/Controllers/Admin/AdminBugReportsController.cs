using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/bug-reports")]
    [Authorize]
    public class AdminBugReportsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AdminBugReportsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? status = null)
        {
            if (!IsSuperAdmin())
                return StatusCode(403, new { message = "Access denied. Super admin only." });

            var query = _db.BugReports.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(r => r.Status == status);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new
                {
                    r.Id,
                    r.Email,
                    r.Subject,
                    r.Description,
                    r.Status,
                    r.CreatedAt,
                    userId = r.UserId,
                })
                .ToListAsync();

            return Ok(new { total, items });
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateBugReportStatusDto dto)
        {
            if (!IsSuperAdmin())
                return StatusCode(403, new { message = "Access denied. Super admin only." });

            var report = await _db.BugReports.FindAsync(id);
            if (report == null) return NotFound();

            report.Status = dto.Status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private bool IsSuperAdmin()
        {
            var role = User.FindFirstValue(ClaimTypes.Role)
                    ?? User.FindFirstValue("role");
            return role == RoleNames.SuperAdmin;
        }
    }

    public class UpdateBugReportStatusDto
    {
        public string Status { get; set; } = "open";
    }
}
