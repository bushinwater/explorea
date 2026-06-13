using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers.Admin
{
    /// <summary>
    /// Live-validation endpoint used by the admin create modals — answers
    /// "does an entity with this name already exist?" while the user is still
    /// typing. Uses NameNormalizer so Serbian diacritics and ASCII fallbacks
    /// count as duplicates ("Nis" vs "Niš").
    /// </summary>
    [ApiController]
    [Route("api/admin/check-name")]
    [Authorize]
    public class AdminEntityNameCheckController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminEntityNameCheckController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/admin/check-name?entity=destination&name=Niš
        [HttpGet]
        public async Task<IActionResult> Check(
            [FromQuery] string entity,
            [FromQuery] string name,
            [FromQuery] Guid? excludeId = null)
        {
            var normalized = NameNormalizer.Normalize(name);
            if (normalized.Length == 0) return Ok(new { exists = false });

            List<string> existingNames;
            switch ((entity ?? string.Empty).Trim().ToLowerInvariant())
            {
                case "destination":
                    existingNames = await _context.Destinations
                        .Where(d => !d.IsDeleted && (excludeId == null || d.Id != excludeId))
                        .Select(d => d.Name)
                        .ToListAsync();
                    break;
                case "place":
                    existingNames = await _context.Places
                        .Where(p => !p.IsDeleted && (excludeId == null || p.Id != excludeId))
                        .Select(p => p.Name)
                        .ToListAsync();
                    break;
                case "event":
                    existingNames = await _context.Events
                        .Where(e => !e.IsDeleted && (excludeId == null || e.Id != excludeId))
                        .Select(e => e.Name)
                        .ToListAsync();
                    break;
                case "activity":
                    existingNames = await _context.Activities
                        .Where(a => !a.IsDeleted && (excludeId == null || a.Id != excludeId))
                        .Select(a => a.Name)
                        .ToListAsync();
                    break;
                default:
                    return BadRequest(new { message = "Nepoznat tip entiteta." });
            }

            var exists = existingNames.Any(n => NameNormalizer.Normalize(n) == normalized);
            return Ok(new { exists });
        }
    }
}
