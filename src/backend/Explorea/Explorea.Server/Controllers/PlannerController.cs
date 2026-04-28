using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/planner")]
    [Authorize]
    public class PlannerController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PlannerController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/planner/month?year=2026&month=7
        [HttpGet("month")]
        public async Task<IActionResult> GetMonth([FromQuery] int year, [FromQuery] int month)
        {
            var userId = await GetCurrentUserId();
            var plan   = await GetOrCreatePlan(userId);

            var start = new DateTimeOffset(year, month, 1, 0, 0, 0, TimeSpan.Zero);
            var end   = start.AddMonths(1);

            var dates = await _context.TripPlanItems
                .Where(i => i.TripPlanId == plan.Id &&
                            i.PlannedAt  >= start &&
                            i.PlannedAt  <  end)
                .Select(i => i.PlannedAt!.Value)
                .ToListAsync();

            var dots = dates
                .GroupBy(d => new { d.Year, d.Month, d.Day })
                .Select(g => new {
                    date  = $"{g.Key.Year:D4}-{g.Key.Month:D2}-{g.Key.Day:D2}",
                    count = g.Count(),
                })
                .ToList();

            return Ok(dots);
        }

        // GET /api/planner/day?date=2026-07-15
        [HttpGet("day")]
        public async Task<IActionResult> GetDay([FromQuery] string date)
        {
            if (!DateTime.TryParseExact(date, "yyyy-MM-dd", null,
                    System.Globalization.DateTimeStyles.None, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });

            var userId = await GetCurrentUserId();
            var plan   = await GetOrCreatePlan(userId);

            var startOfDay = new DateTimeOffset(parsedDate.Year, parsedDate.Month, parsedDate.Day, 0, 0, 0, TimeSpan.Zero);
            var endOfDay   = startOfDay.AddDays(1);

            var items = await _context.TripPlanItems
                .Where(i => i.TripPlanId == plan.Id &&
                            i.EntityType == "event"  &&
                            i.PlannedAt  >= startOfDay &&
                            i.PlannedAt  <  endOfDay)
                .ToListAsync();

            var eventIds = items.Select(i => i.EntityId).Distinct().ToList();
            var eventsMap = await _context.Events
                .Where(e => eventIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Name, e.Slug, e.StartDatetime, e.EndDatetime })
                .ToDictionaryAsync(e => e.Id);

            var result = items.Select(i => {
                eventsMap.TryGetValue(i.EntityId, out var ev);
                return new {
                    id            = i.Id,
                    eventId       = i.EntityId,
                    eventName     = ev?.Name ?? "(nepoznat događaj)",
                    eventSlug     = ev?.Slug ?? "",
                    plannedAt     = i.PlannedAt!.Value.ToString("yyyy-MM-dd"),
                    note          = i.Note,
                    startDatetime = ev?.StartDatetime.ToString("o"),
                    endDatetime   = ev?.EndDatetime.ToString("o"),
                };
            }).ToList();

            return Ok(result);
        }

        // POST /api/planner/add
        [HttpPost("add")]
        public async Task<IActionResult> Add([FromBody] AddPlannerItemRequest request)
        {
            var userId = await GetCurrentUserId();
            var plan   = await GetOrCreatePlan(userId);

            var eventExists = await _context.Events
                .AnyAsync(e => e.Id == request.EventId && !e.IsDeleted);
            if (!eventExists)
                return NotFound(new { message = "Event not found." });

            if (!DateTime.TryParseExact(request.PlannedAt, "yyyy-MM-dd", null,
                    System.Globalization.DateTimeStyles.None, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });

            var item = new TripPlanItem
            {
                Id         = Guid.NewGuid(),
                TripPlanId = plan.Id,
                EntityType = "event",
                EntityId   = request.EventId,
                PlannedAt  = new DateTimeOffset(parsedDate.Year, parsedDate.Month, parsedDate.Day, 0, 0, 0, TimeSpan.Zero),
                Note       = request.Note?.Trim(),
                SortOrder  = 0,
                CreatedAt  = DateTimeOffset.UtcNow,
                CreatedBy  = userId,
            };

            _context.TripPlanItems.Add(item);
            await _context.SaveChangesAsync();

            return StatusCode(201, new { id = item.Id });
        }

        // DELETE /api/planner/items/{id}
        [HttpDelete("items/{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var userId = await GetCurrentUserId();
            var plan   = await _context.TripPlans
                .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == "My Planner");

            if (plan == null) return NotFound();

            var item = await _context.TripPlanItems
                .FirstOrDefaultAsync(i => i.Id == id && i.TripPlanId == plan.Id);

            if (item == null) return NotFound();

            _context.TripPlanItems.Remove(item);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ─── Helpers ──────────────────────────────────────────────

        private async Task<TripPlan> GetOrCreatePlan(Guid userId)
        {
            var plan = await _context.TripPlans
                .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == "My Planner");

            if (plan != null) return plan;

            plan = new TripPlan
            {
                Id        = Guid.NewGuid(),
                UserId    = userId,
                Name      = "My Planner",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                CreatedBy = userId,
            };
            _context.TripPlans.Add(plan);
            await _context.SaveChangesAsync();
            return plan;
        }

        private async Task<Guid> GetCurrentUserId()
        {
            var email = User.FindFirstValue(ClaimTypes.Email)
                     ?? User.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email claim not found in token.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                throw new Exception("User not found.");

            return user.Id;
        }
    }

    public class AddPlannerItemRequest
    {
        public Guid    EventId   { get; set; }
        public string  PlannedAt { get; set; } = null!;
        public string? Note      { get; set; }
    }
}
