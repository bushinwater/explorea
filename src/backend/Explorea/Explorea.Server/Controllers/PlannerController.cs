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
                            i.PlannedAt  >= startOfDay &&
                            i.PlannedAt  <  endOfDay)
                .ToListAsync();

            // Resolve entity details per type
            var eventIds    = items.Where(i => i.EntityType == "event")       .Select(i => i.EntityId).Distinct().ToList();
            var destIds     = items.Where(i => i.EntityType == "destination") .Select(i => i.EntityId).Distinct().ToList();
            var placeIds    = items.Where(i => i.EntityType == "place")       .Select(i => i.EntityId).Distinct().ToList();
            var activityIds = items.Where(i => i.EntityType == "activity")    .Select(i => i.EntityId).Distinct().ToList();

            var eventsMap     = (await _context.Events      .Where(e => eventIds   .Contains(e.Id)).Select(e => new { e.Id, e.Name, e.Slug, e.PreviewImageUrl }).ToListAsync()).ToDictionary(x => x.Id);
            var destsMap      = (await _context.Destinations.Where(d => destIds    .Contains(d.Id)).Select(d => new { d.Id, d.Name, d.Slug, d.PreviewImageUrl }).ToListAsync()).ToDictionary(x => x.Id);
            var placesMap     = (await _context.Places      .Where(p => placeIds   .Contains(p.Id)).Select(p => new { p.Id, p.Name, p.Slug, p.PreviewImageUrl }).ToListAsync()).ToDictionary(x => x.Id);
            var activitiesMap = (await _context.Activities  .Where(a => activityIds.Contains(a.Id)).Select(a => new { a.Id, a.Name, a.Slug, a.PreviewImageUrl }).ToListAsync()).ToDictionary(x => x.Id);

            var result = items.Select(i =>
            {
                string  name            = "(nepoznat entitet)";
                string  slug            = "";
                string? previewImageUrl = null;

                switch (i.EntityType)
                {
                    case "event":
                        if (eventsMap    .TryGetValue(i.EntityId, out var ev))   { name = ev.Name;   slug = ev.Slug;   previewImageUrl = ev.PreviewImageUrl; }   break;
                    case "destination":
                        if (destsMap     .TryGetValue(i.EntityId, out var dest)) { name = dest.Name; slug = dest.Slug; previewImageUrl = dest.PreviewImageUrl; } break;
                    case "place":
                        if (placesMap    .TryGetValue(i.EntityId, out var pl))   { name = pl.Name;   slug = pl.Slug;   previewImageUrl = pl.PreviewImageUrl; }   break;
                    case "activity":
                        if (activitiesMap.TryGetValue(i.EntityId, out var act))  { name = act.Name;  slug = act.Slug;  previewImageUrl = act.PreviewImageUrl; }  break;
                }

                return new {
                    id              = i.Id,
                    entityType      = i.EntityType,
                    entityId        = i.EntityId,
                    entityName      = name,
                    entitySlug      = slug,
                    previewImageUrl = previewImageUrl,
                    plannedAt       = i.PlannedAt!.Value.ToString("yyyy-MM-dd"),
                    note            = i.Note,
                };
            }).ToList();

            return Ok(result);
        }

        // GET /api/planner/expired-events
        [HttpGet("expired-events")]
        public async Task<IActionResult> GetExpiredEvents()
        {
            var userId = await GetCurrentUserId();
            var plan = await _context.TripPlans
                .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == "My Planner");

            if (plan == null) return Ok(Array.Empty<object>());

            var now = DateTimeOffset.UtcNow;
            var todayStart = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);
            var windowStart = todayStart.AddDays(-1);

            var expiredEventsRaw = await (
                from item in _context.TripPlanItems
                join ev in _context.Events on item.EntityId equals ev.Id
                where item.TripPlanId == plan.Id
                    && item.EntityType == "event"
                    && ev.EndDatetime < now
                    && ev.EndDatetime >= windowStart
                orderby ev.EndDatetime descending
                select new
                {
                    id = item.Id,
                    entityId = ev.Id,
                    entityName = ev.Name,
                    entitySlug = ev.Slug,
                    plannedAt = item.PlannedAt,
                    eventEndedAt = ev.EndDatetime,
                })
                .Take(10)
                .ToListAsync();

            var expiredEvents = expiredEventsRaw.Select(item => new
            {
                item.id,
                item.entityId,
                item.entityName,
                item.entitySlug,
                plannedAt = item.plannedAt.HasValue ? item.plannedAt.Value.ToString("yyyy-MM-dd") : null,
                item.eventEndedAt,
            });

            return Ok(expiredEvents);
        }

        // POST /api/planner/add
        [HttpPost("add")]
        public async Task<IActionResult> Add([FromBody] AddPlannerItemRequest request)
        {
            var userId = await GetCurrentUserId();
            var plan   = await GetOrCreatePlan(userId);

            var now = DateTimeOffset.UtcNow;
            var eventExists = await _context.Events
                .AnyAsync(e =>
                    e.Id == request.EventId &&
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= now);
            if (!eventExists)
                return NotFound(new { message = "Event not found." });

            if (!DateTime.TryParseExact(request.PlannedAt, "yyyy-MM-dd", null,
                    System.Globalization.DateTimeStyles.None, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });

            var dayStart = new DateTimeOffset(parsedDate.Year, parsedDate.Month, parsedDate.Day, 0, 0, 0, TimeSpan.Zero);
            var dayEnd   = dayStart.AddDays(1);
            var already  = await _context.TripPlanItems.AnyAsync(i =>
                i.TripPlanId == plan.Id &&
                i.EntityType == "event" &&
                i.EntityId   == request.EventId &&
                i.PlannedAt  >= dayStart &&
                i.PlannedAt  <  dayEnd);
            if (already)
                return Conflict(new { message = "Već si dodao ovaj događaj za taj dan." });

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

        // POST /api/planner/add-entity
        [HttpPost("add-entity")]
        public async Task<IActionResult> AddEntity([FromBody] AddGenericPlannerItemRequest request)
        {
            var allowed = new[] { "event", "destination", "place", "activity" };
            if (!allowed.Contains(request.EntityType))
                return BadRequest(new { message = "Invalid entity type." });

            if (!DateTime.TryParseExact(request.PlannedAt, "yyyy-MM-dd", null,
                    System.Globalization.DateTimeStyles.None, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });

            var userId = await GetCurrentUserId();
            var plan   = await GetOrCreatePlan(userId);

            var dayStart = new DateTimeOffset(parsedDate.Year, parsedDate.Month, parsedDate.Day, 0, 0, 0, TimeSpan.Zero);
            var dayEnd   = dayStart.AddDays(1);
            var already  = await _context.TripPlanItems.AnyAsync(i =>
                i.TripPlanId == plan.Id &&
                i.EntityType == request.EntityType &&
                i.EntityId   == request.EntityId &&
                i.PlannedAt  >= dayStart &&
                i.PlannedAt  <  dayEnd);
            if (already)
                return Conflict(new { message = "Već si dodao ovaj entitet za taj dan." });

            var item = new TripPlanItem
            {
                Id         = Guid.NewGuid(),
                TripPlanId = plan.Id,
                EntityType = request.EntityType,
                EntityId   = request.EntityId,
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

        // DELETE /api/planner/entity/{entityType}/{entityId}
        [HttpDelete("entity/{entityType}/{entityId:guid}")]
        public async Task<IActionResult> DeleteAllForEntity(string entityType, Guid entityId)
        {
            var userId = await GetCurrentUserId();
            var plan   = await _context.TripPlans
                .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == "My Planner");

            if (plan == null) return NoContent();

            var items = await _context.TripPlanItems
                .Where(i => i.TripPlanId == plan.Id &&
                            i.EntityType == entityType &&
                            i.EntityId   == entityId)
                .ToListAsync();

            _context.TripPlanItems.RemoveRange(items);
            await _context.SaveChangesAsync();
            return NoContent();
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

    public class AddGenericPlannerItemRequest
    {
        public string  EntityType { get; set; } = null!;
        public Guid    EntityId   { get; set; }
        public string  PlannedAt  { get; set; } = null!;
        public string? Note       { get; set; }
    }
}
