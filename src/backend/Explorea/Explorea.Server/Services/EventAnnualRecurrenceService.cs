using Explorea.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class EventAnnualRecurrenceService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromDays(1);
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EventAnnualRecurrenceService> _logger;

        public EventAnnualRecurrenceService(
            IServiceScopeFactory scopeFactory,
            ILogger<EventAnnualRecurrenceService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await RenewExpiredAnnualEventsAsync(stoppingToken);
                await Task.Delay(CheckInterval, stoppingToken);
            }
        }

        private async Task RenewExpiredAnnualEventsAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTimeOffset.UtcNow;

                var events = await db.Events
                    .IgnoreQueryFilters()
                    .Where(e =>
                        e.RecursAnnually &&
                        !e.IsDeleted &&
                        e.EndDatetime < now)
                    .ToListAsync(cancellationToken);

                foreach (var ev in events)
                {
                    var duration = ev.EndDatetime - ev.StartDatetime;
                    var newStart = ev.StartDatetime.AddYears(1);

                    while (newStart + duration <= now)
                        newStart = newStart.AddYears(1);

                    ev.StartDatetime = newStart;
                    ev.EndDatetime = newStart + duration;
                    ev.UpdatedAt = now;
                }

                if (events.Count > 0)
                    await db.SaveChangesAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to renew expired annual events.");
            }
        }
    }
}
