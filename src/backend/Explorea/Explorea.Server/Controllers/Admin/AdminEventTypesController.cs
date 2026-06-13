using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/event-types")]
    [Authorize]
    public class AdminEventTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminEventTypesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var types = await _context.EventTypes
                .AsNoTracking()
                .OrderBy(t => t.Name)
                .Select(t => new { id = t.Id, name = t.Name })
                .ToListAsync();

            return Ok(types);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTypeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "Name is required." });

            var now = DateTimeOffset.UtcNow;
            var et = new EventType { Name = req.Name.Trim(), CreatedAt = now, UpdatedAt = now };
            _context.EventTypes.Add(et);
            await _context.SaveChangesAsync();

            // Auto-seed a "Besplatan ulaz" boolean filter for this new event type,
            // matching the convention used by other event categories.
            var exists = await _context.FilterDefinitions
                .AnyAsync(f => f.EntityType == "event" && f.TypeId == et.Id && f.FilterKey == "free_entry");
            if (!exists)
            {
                _context.FilterDefinitions.Add(new FilterDefinition
                {
                    EntityType  = "event",
                    TypeId      = et.Id,
                    FilterKey   = "free_entry",
                    FilterLabel = "Besplatan ulaz",
                    FilterType  = "boolean",
                    SortOrder   = 0,
                    CreatedAt   = now,
                    UpdatedAt   = now,
                });
                await _context.SaveChangesAsync();
            }

            return Ok(new { id = et.Id, name = et.Name });
        }

        public record CreateTypeRequest(string Name);
    }
}
