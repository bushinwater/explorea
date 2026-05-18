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
            return await _db.AdminActivityLogs
                .OrderByDescending(log => log.CreatedAt)
                .Take(Math.Clamp(limit, 1, 50))
                .ToListAsync();
        }
    }
}
