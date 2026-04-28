using Explorea.API.DTOs.BugReport;
using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/bug-reports")]
    public class BugReportsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public BugReportsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBugReportDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Subject) || string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest(new { message = "Subject and description are required." });

            Guid? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
                if (!string.IsNullOrWhiteSpace(email))
                {
                    var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                    userId = user?.Id;
                }
            }

            var report = new BugReport
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
                Subject = dto.Subject.Trim(),
                Description = dto.Description.Trim(),
                Status = "open",
                CreatedAt = DateTimeOffset.UtcNow,
            };

            _db.BugReports.Add(report);
            await _db.SaveChangesAsync();

            return StatusCode(201, new { id = report.Id });
        }
    }
}
