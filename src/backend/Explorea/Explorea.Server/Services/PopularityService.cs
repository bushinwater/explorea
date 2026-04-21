using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class PopularityService : IPopularityService
    {
        private static readonly TimeSpan AuthCooldown = TimeSpan.FromHours(24);
        private static readonly TimeSpan AnonCooldown = TimeSpan.FromHours(48);
        private static readonly HashSet<string> ValidTypes = new(StringComparer.OrdinalIgnoreCase)
            { "destination", "place", "event", "activity" };

        private readonly AppDbContext _db;

        public PopularityService(AppDbContext db) => _db = db;

        public async Task TrackClickAsync(string entityType, Guid entityId, Guid? userId, string? sessionId)
        {
            var type = entityType.ToLower();
            if (!ValidTypes.Contains(type)) return;

            var now = DateTimeOffset.UtcNow;

            if (userId.HasValue)
            {
                var recentExists = await _db.PopularityLogs.AnyAsync(l =>
                    l.UserId == userId &&
                    l.EntityType == type &&
                    l.EntityId == entityId &&
                    l.Source == "click" &&
                    l.CreatedAt > now - AuthCooldown);

                if (recentExists) return;
            }
            else if (!string.IsNullOrEmpty(sessionId))
            {
                var recentExists = await _db.PopularityLogs.AnyAsync(l =>
                    l.SessionId == sessionId &&
                    l.EntityType == type &&
                    l.EntityId == entityId &&
                    l.Source == "click" &&
                    l.CreatedAt > now - AnonCooldown);

                if (recentExists) return;
            }
            else
            {
                return;
            }

            await IncrementAsync(type, entityId, 1);

            _db.PopularityLogs.Add(new PopularityLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                SessionId = userId.HasValue ? null : sessionId,
                EntityType = type,
                EntityId = entityId,
                Source = "click",
                Points = 1,
                CreatedAt = now
            });

            await _db.SaveChangesAsync();

            if (userId.HasValue)
                await UpdateInterestScoresAsync(userId.Value, type, entityId, 1);
        }

        public async Task TrackSaveAsync(string entityType, Guid entityId, Guid userId)
        {
            var type = entityType.ToLower();
            if (!ValidTypes.Contains(type)) return;

            var alreadyLogged = await _db.PopularityLogs.AnyAsync(l =>
                l.UserId == userId &&
                l.EntityType == type &&
                l.EntityId == entityId &&
                l.Source == "save");

            if (alreadyLogged) return;

            await IncrementAsync(type, entityId, 3);

            _db.PopularityLogs.Add(new PopularityLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = type,
                EntityId = entityId,
                Source = "save",
                Points = 3,
                CreatedAt = DateTimeOffset.UtcNow
            });

            await _db.SaveChangesAsync();
            await UpdateInterestScoresAsync(userId, type, entityId, 3);
        }

        private async Task UpdateInterestScoresAsync(Guid userId, string entityType, Guid entityId, int points)
        {
            var tagIds = entityType switch
            {
                "destination" => await _db.DestinationInterestTags
                    .Where(x => x.DestinationId == entityId).Select(x => x.InterestTagId).ToListAsync(),
                "place" => await _db.PlaceInterestTags
                    .Where(x => x.PlaceId == entityId).Select(x => x.InterestTagId).ToListAsync(),
                "event" => await _db.EventInterestTags
                    .Where(x => x.EventId == entityId).Select(x => x.InterestTagId).ToListAsync(),
                "activity" => await _db.ActivityInterestTags
                    .Where(x => x.ActivityId == entityId).Select(x => x.InterestTagId).ToListAsync(),
                _ => new List<int>()
            };

            foreach (var tagId in tagIds)
            {
                await _db.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO user_interest_scores (user_id, interest_tag_id, score, last_updated)
                    VALUES ({0}, {1}, {2}, NOW())
                    ON CONFLICT (user_id, interest_tag_id)
                    DO UPDATE SET score = user_interest_scores.score + {2}, last_updated = NOW()",
                    userId, tagId, points);
            }
        }

        private async Task IncrementAsync(string entityType, Guid entityId, int points)
        {
            var table = entityType switch
            {
                "destination" => "destinations",
                "place"       => "places",
                "event"       => "events",
                "activity"    => "activities",
                _             => null
            };

            if (table == null) return;

            await _db.Database.ExecuteSqlRawAsync(
                $"UPDATE {table} SET popularity = popularity + {{0}} WHERE id = {{1}}",
                points, entityId);
        }
    }
}
