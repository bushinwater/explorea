using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class NotificationReportBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<NotificationReportBackgroundService> _logger;

        public NotificationReportBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<NotificationReportBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Sync to the top of the next hour so checks run exactly at HH:00
            var initialDelay = TimeUntilNextHour();
            _logger.LogInformation(
                "Notification report service starting. First check in {Minutes} min.",
                (int)initialDelay.TotalMinutes);

            try { await Task.Delay(initialDelay, stoppingToken); }
            catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                await RunDueReportsAsync();

                try { await Task.Delay(TimeUntilNextHour(), stoppingToken); }
                catch (OperationCanceledException) { return; }
            }
        }

        private async Task RunDueReportsAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IAdminNotificationReportService>();
                var sentCount = await service.SendDueReportsAsync(DateTimeOffset.UtcNow);

                if (sentCount > 0)
                    _logger.LogInformation("Sent {Count} admin notification report email(s).", sentCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending admin notification reports.");
            }
        }

        // Returns the time remaining until the start of the next UTC hour (e.g. 09:00:00)
        private static TimeSpan TimeUntilNextHour()
        {
            var now      = DateTimeOffset.UtcNow;
            var nextHour = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, 0, 0, TimeSpan.Zero)
                .AddHours(1);
            return nextHour - now;
        }
    }
}
