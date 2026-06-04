using Explorea.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(AppDbContext db)
        {
            try { await db.Database.ExecuteSqlRawAsync("CREATE EXTENSION IF NOT EXISTS unaccent;"); }
            catch { /* unaccent may require superuser on some setups */ }

            try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE activities ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions(id);"); }
            catch { /* column may already exist */ }

            try
            {
                await db.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM events
                    WHERE visibility = 'rejected'
                      AND updated_at < NOW() - INTERVAL '30 days';
                ");
                await db.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM submission_queue
                    WHERE status IN ('RejectedByTO', 'RejectedByOwner')
                      AND COALESCE(reviewed_by_to_at, reviewed_by_owner_at, submitted_at) < NOW() - INTERVAL '30 days';
                ");
                await db.Database.ExecuteSqlRawAsync(@"
                    UPDATE places SET is_deleted = TRUE, deleted_at = NOW()
                    WHERE approval_status = 'rejected'
                      AND updated_at < NOW() - INTERVAL '30 days'
                      AND is_deleted = FALSE;
                ");
            }
            catch { /* cleanup errors are non-fatal */ }

            try
            {
                // Recreate missing queue items for pending events that were restored without one
                await db.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO submission_queue (id, entity_type, entity_id, destination_id, linked_place_id, status, submitted_by_user_id, submitted_at, request_payload)
                    SELECT
                        gen_random_uuid(),
                        'event',
                        e.id,
                        e.destination_id,
                        e.place_id,
                        'Pending',
                        COALESCE(e.created_by, '00000000-0000-0000-0000-000000000000'),
                        NOW(),
                        '{}'
                    FROM events e
                    WHERE e.visibility = 'pending'
                      AND e.is_deleted = FALSE
                      AND e.destination_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1 FROM submission_queue sq
                        WHERE sq.entity_id = e.id AND sq.entity_type = 'event'
                      );
                ");
            }
            catch { /* non-fatal */ }

            try
            {
                // Publish events that were approved by owner but never had visibility set to published
                await db.Database.ExecuteSqlRawAsync(@"
                    UPDATE events e
                    SET visibility = 'published', updated_at = NOW()
                    FROM submission_queue sq
                    WHERE sq.entity_type = 'event'
                      AND sq.entity_id = e.id
                      AND sq.status IN ('ApprovedByOwner', 'ApprovedByTO')
                      AND e.visibility = 'pending'
                      AND e.is_deleted = FALSE;
                ");
            }
            catch { /* backfill errors are non-fatal */ }

            try {
                // Backfill region_id from city for activities that have a city but no direct region
                await db.Database.ExecuteSqlRawAsync(@"
                    UPDATE activities a
                    SET region_id = c.region_id
                    FROM cities c
                    WHERE a.city_id = c.id
                      AND a.region_id IS NULL
                      AND c.region_id IS NOT NULL;
                ");
                // Backfill region_id from creator's managed region for TO-created activities with no city
                await db.Database.ExecuteSqlRawAsync(@"
                    UPDATE activities a
                    SET region_id = u.managed_region_id
                    FROM users u
                    WHERE a.created_by = u.id
                      AND a.region_id IS NULL
                      AND a.city_id IS NULL
                      AND u.managed_region_id IS NOT NULL;
                ");
            } catch { /* backfill errors are non-fatal */ }

            if (await db.InterestTags.AnyAsync()) return;

            var now = DateTimeOffset.UtcNow;
            var tags = new[]
            {
                new InterestTag { Name = "Priroda",        Icon = "🌿", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Planine",        Icon = "⛰️", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Jezera i reke",  Icon = "💧", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Istorija",       Icon = "🏛️", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Kultura",        Icon = "🎭", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Avantura",       Icon = "🧗", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Hrana i piće",   Icon = "🍽️", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Festivali",      Icon = "🎉", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Sport",          Icon = "⚽", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Porodica",       Icon = "👨‍👩‍👧", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Spa i wellness", Icon = "🧘", CreatedAt = now, UpdatedAt = now },
                new InterestTag { Name = "Fotografija",    Icon = "📷", CreatedAt = now, UpdatedAt = now },
            };

            await db.InterestTags.AddRangeAsync(tags);
            await db.SaveChangesAsync();
        }
    }
}
