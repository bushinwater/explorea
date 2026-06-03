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
