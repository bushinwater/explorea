using Explorea.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class UserPurgeService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<UserPurgeService> _logger;

        public UserPurgeService(IServiceScopeFactory scopeFactory, ILogger<UserPurgeService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PurgeDeletedUsersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error while purging soft-deleted users.");
                }

                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }

        private async Task PurgeDeletedUsersAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);

            var toPurge = await db.Users
                .Where(u => u.DeletedAt != null && u.DeletedAt < cutoff)
                .ToListAsync();

            if (toPurge.Count > 0)
            {
                db.Users.RemoveRange(toPurge);
                await db.SaveChangesAsync();
                _logger.LogInformation("Permanently purged {Count} soft-deleted user(s).", toPurge.Count);
            }
        }
    }
}
