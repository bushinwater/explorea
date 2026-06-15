using Explorea.Server.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Explorea.Server.Services
{
    // Permanently removes soft-deleted destinations, places, events and
    // activities once they pass the 30-day grace period. Without this, rows
    // marked IsDeleted=true accumulate forever (the admin "deleted" tab was
    // showing entries 30+ days old that should already be gone).
    public class SoftDeleteCleanupService : BackgroundService
    {
        private static readonly TimeSpan GracePeriod = TimeSpan.FromDays(30);
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SoftDeleteCleanupService> _logger;

        public SoftDeleteCleanupService(IServiceScopeFactory scopeFactory, ILogger<SoftDeleteCleanupService> logger)
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
                    await PurgeAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in soft-delete cleanup tick.");
                }

                try
                {
                    await Task.Delay(Interval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task PurgeAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var cutoff = DateTimeOffset.UtcNow - GracePeriod;

            // Order matters: children (events/places/activities) before
            // destinations so any Restrict FK from child to destination is
            // satisfied. SubmissionQueue.DestinationId is Restrict — clear
            // matching queue rows first so destination purge doesn't fail.
            await PurgeTypeAsync(db, db.Events,
                e => e.IsDeleted && e.DeletedAt != null && e.DeletedAt < cutoff,
                "event", ct);
            await PurgeTypeAsync(db, db.Activities,
                a => a.IsDeleted && a.DeletedAt != null && a.DeletedAt < cutoff,
                "activity", ct);
            await PurgeTypeAsync(db, db.Places,
                p => p.IsDeleted && p.DeletedAt != null && p.DeletedAt < cutoff,
                "place", ct);

            await PurgeDestinationsAsync(db, cutoff, ct);
        }

        private async Task PurgeDestinationsAsync(AppDbContext db, DateTimeOffset cutoff, CancellationToken ct)
        {
            try
            {
                var ids = await db.Destinations
                    .IgnoreQueryFilters()
                    .Where(d => d.IsDeleted && d.DeletedAt != null && d.DeletedAt < cutoff)
                    .Select(d => d.Id)
                    .ToListAsync(ct);
                if (ids.Count == 0) return;

                // SubmissionQueue.DestinationId is Restrict; drop those rows
                // before deleting the destinations themselves.
                await db.SubmissionQueue
                    .Where(q => ids.Contains(q.DestinationId))
                    .ExecuteDeleteAsync(ct);

                var toPurge = await db.Destinations
                    .IgnoreQueryFilters()
                    .Where(d => ids.Contains(d.Id))
                    .ToListAsync(ct);

                db.Destinations.RemoveRange(toPurge);
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Permanently purged {Count} soft-deleted destination(s).", toPurge.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to purge soft-deleted destination rows.");
            }
        }

        private async Task PurgeTypeAsync<T>(AppDbContext db, DbSet<T> set,
            Expression<Func<T, bool>> predicate, string label, CancellationToken ct)
            where T : class
        {
            try
            {
                var toPurge = await set.IgnoreQueryFilters().Where(predicate).ToListAsync(ct);
                if (toPurge.Count == 0) return;
                set.RemoveRange(toPurge);
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Permanently purged {Count} soft-deleted {Label}(s).", toPurge.Count, label);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to purge soft-deleted {Label} rows.", label);
            }
        }
    }
}
