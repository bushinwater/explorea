using Explorea.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class SupportRetentionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SupportRetentionService> _logger;

        public SupportRetentionService(
            IServiceScopeFactory scopeFactory,
            ILogger<SupportRetentionService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await PurgeOldTicketsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }

        private async Task PurgeOldTicketsAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var cutoff = DateTimeOffset.UtcNow.AddDays(-30);

                var oldTickets = await db.SupportTickets
                    .Where(t => t.LastActivityAt < cutoff)
                    .ToListAsync(ct);

                if (oldTickets.Count == 0) return;

                var ticketIds = oldTickets.Select(t => t.Id).ToList();

                var oldMessages = await db.SupportMessages
                    .Where(m => ticketIds.Contains(m.TicketId))
                    .ToListAsync(ct);

                db.SupportMessages.RemoveRange(oldMessages);
                db.SupportTickets.RemoveRange(oldTickets);
                await db.SaveChangesAsync(ct);

                _logger.LogInformation(
                    "SupportRetentionService: obrisano {Count} tiketa starijih od 30 dana.",
                    oldTickets.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "SupportRetentionService: greška pri brisanju starih tiketa.");
            }
        }
    }
}
