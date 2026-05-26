using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class SavedItemCleanupService : ISavedItemCleanupService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;
        private readonly ILogger<SavedItemCleanupService> _logger;

        public SavedItemCleanupService(
            AppDbContext db,
            IEmailService emailService,
            ILogger<SavedItemCleanupService> logger)
        {
            _db = db;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task RemoveDeletedEntityFromSavedItemsAsync(
            string entityType,
            Guid entityId,
            string entityName)
        {
            var savedItems = await _db.SavedItems
                .Include(item => item.User)
                .Where(item => item.EntityType == entityType && item.EntityId == entityId)
                .ToListAsync();

            if (savedItems.Count == 0) return;

            var recipients = savedItems
                .Select(item => item.User)
                .Where(user => !string.IsNullOrWhiteSpace(user.Email))
                .GroupBy(user => user.Email.Trim().ToLowerInvariant())
                .Select(group => group.First())
                .ToList();

            _db.SavedItems.RemoveRange(savedItems);
            await _db.SaveChangesAsync();

            foreach (var user in recipients)
            {
                try
                {
                    await _emailService.SendSavedItemDeletedEmailAsync(
                        user.Email,
                        user.FirstName,
                        entityName);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to send saved item deletion email to {Email} for {EntityType} {EntityId}.",
                        user.Email,
                        entityType,
                        entityId);
                }
            }
        }
    }
}
