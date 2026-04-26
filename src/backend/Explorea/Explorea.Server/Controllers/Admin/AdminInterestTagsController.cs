using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/interest-tags")]
    [Authorize]
    public class AdminInterestTagsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AdminInterestTagsController(AppDbContext db) => _db = db;

        // GET /api/admin/interest-tags/{entityType}/{entityId}
        // Returns all interest tags with a flag indicating which are assigned to the entity
        [HttpGet("{entityType}/{entityId:guid}")]
        public async Task<IActionResult> GetTags(string entityType, Guid entityId)
        {
            var type = entityType.ToLower();
            if (!IsValidType(type)) return BadRequest("Invalid entity type.");

            var allTags = await _db.InterestTags
                .OrderBy(t => t.Name)
                .Select(t => new { t.Id, t.Name, t.Icon })
                .ToListAsync();

            var assignedIds = await GetAssignedTagIds(type, entityId);

            var result = allTags.Select(t => new
            {
                t.Id,
                t.Name,
                t.Icon,
                IsAssigned = assignedIds.Contains(t.Id),
            });

            return Ok(result);
        }

        // PUT /api/admin/interest-tags/{entityType}/{entityId}
        // Replaces the full set of interest tag assignments for the entity
        [HttpPut("{entityType}/{entityId:guid}")]
        public async Task<IActionResult> SetTags(string entityType, Guid entityId, [FromBody] SetEntityInterestTagsDto dto)
        {
            var type = entityType.ToLower();
            if (!IsValidType(type)) return BadRequest("Invalid entity type.");

            await RemoveAllTags(type, entityId);

            foreach (var tagId in (dto.TagIds ?? []).Distinct())
            {
                switch (type)
                {
                    case "destination":
                        _db.DestinationInterestTags.Add(new DestinationInterestTag { DestinationId = entityId, InterestTagId = tagId });
                        break;
                    case "place":
                        _db.PlaceInterestTags.Add(new PlaceInterestTag { PlaceId = entityId, InterestTagId = tagId });
                        break;
                    case "event":
                        _db.EventInterestTags.Add(new EventInterestTag { EventId = entityId, InterestTagId = tagId });
                        break;
                    case "activity":
                        _db.ActivityInterestTags.Add(new ActivityInterestTag { ActivityId = entityId, InterestTagId = tagId });
                        break;
                }
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<HashSet<int>> GetAssignedTagIds(string type, Guid entityId) => type switch
        {
            "destination" => (await _db.DestinationInterestTags
                .Where(x => x.DestinationId == entityId).Select(x => x.InterestTagId).ToListAsync()).ToHashSet(),
            "place" => (await _db.PlaceInterestTags
                .Where(x => x.PlaceId == entityId).Select(x => x.InterestTagId).ToListAsync()).ToHashSet(),
            "event" => (await _db.EventInterestTags
                .Where(x => x.EventId == entityId).Select(x => x.InterestTagId).ToListAsync()).ToHashSet(),
            "activity" => (await _db.ActivityInterestTags
                .Where(x => x.ActivityId == entityId).Select(x => x.InterestTagId).ToListAsync()).ToHashSet(),
            _ => [],
        };

        private async Task RemoveAllTags(string type, Guid entityId)
        {
            switch (type)
            {
                case "destination":
                    var dTags = await _db.DestinationInterestTags.Where(x => x.DestinationId == entityId).ToListAsync();
                    _db.DestinationInterestTags.RemoveRange(dTags);
                    break;
                case "place":
                    var pTags = await _db.PlaceInterestTags.Where(x => x.PlaceId == entityId).ToListAsync();
                    _db.PlaceInterestTags.RemoveRange(pTags);
                    break;
                case "event":
                    var eTags = await _db.EventInterestTags.Where(x => x.EventId == entityId).ToListAsync();
                    _db.EventInterestTags.RemoveRange(eTags);
                    break;
                case "activity":
                    var aTags = await _db.ActivityInterestTags.Where(x => x.ActivityId == entityId).ToListAsync();
                    _db.ActivityInterestTags.RemoveRange(aTags);
                    break;
            }
            await _db.SaveChangesAsync();
        }

        private static bool IsValidType(string type) =>
            type is "destination" or "place" or "event" or "activity";
    }

    public class SetEntityInterestTagsDto
    {
        public List<int> TagIds { get; set; } = [];
    }
}
