using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminActivityLogService : IAdminActivityLogService
    {
        private readonly AppDbContext _db;

        public AdminActivityLogService(AppDbContext db)
        {
            _db = db;
        }

        public async Task LogAsync(string type, string description, Guid? actorId = null)
        {
            await EnsureTableAsync();

            _db.AdminActivityLogs.Add(new AdminActivityLog
            {
                Id = Guid.NewGuid(),
                Type = type.Trim(),
                Description = description.Trim(),
                CreatedAt = DateTimeOffset.UtcNow,
                ActorId = actorId
            });

            await _db.SaveChangesAsync();
        }

        public async Task<List<AdminActivityLog>> GetRecentAsync(int limit)
        {
            await EnsureTableAsync();

            return await _db.AdminActivityLogs
                .OrderByDescending(log => log.CreatedAt)
                .Take(Math.Clamp(limit, 1, 50))
                .ToListAsync();
        }

        private async Task EnsureTableAsync()
        {
            await _db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS admin_activity_log (
                    id uuid PRIMARY KEY,
                    type varchar(80) NOT NULL,
                    description varchar(500) NOT NULL,
                    created_at timestamptz NOT NULL,
                    actor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS ix_admin_activity_log_created_at
                ON admin_activity_log (created_at DESC);
                """);
        }
    }
}
