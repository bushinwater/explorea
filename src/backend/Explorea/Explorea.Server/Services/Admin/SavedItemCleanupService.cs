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

            var plannerItems = await _db.TripPlanItems
                .Include(item => item.TripPlan)
                    .ThenInclude(plan => plan.User)
                .Where(item => item.EntityType == entityType && item.EntityId == entityId)
                .ToListAsync();

            if (savedItems.Count == 0 && plannerItems.Count == 0) return;

            var savedRecipients = savedItems.Select(item => new CleanupRecipient(
                item.User,
                WasSaved: true,
                WasInPlanner: false,
                PlannerNote: null));

            var plannerRecipients = plannerItems.Select(item => new CleanupRecipient(
                item.TripPlan.User,
                WasSaved: false,
                WasInPlanner: true,
                PlannerNote: item.Note));

            var recipients = savedRecipients
                .Concat(plannerRecipients)
                .Where(item => !string.IsNullOrWhiteSpace(item.User.Email))
                .GroupBy(item => item.User.Email.Trim().ToLowerInvariant())
                .Select(group => new
                {
                    User = group.First().User,
                    WasSaved = group.Any(item => item.WasSaved),
                    WasInPlanner = group.Any(item => item.WasInPlanner),
                    PlannerNotes = group
                        .Where(item => item.WasInPlanner && !string.IsNullOrWhiteSpace(item.PlannerNote))
                        .Select(item => item.PlannerNote!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList()
                })
                .ToList();

            _db.SavedItems.RemoveRange(savedItems);
            _db.TripPlanItems.RemoveRange(plannerItems);
            await _db.SaveChangesAsync();

            foreach (var recipient in recipients)
            {
                try
                {
                    await _emailService.SendDeletedEntityReferenceEmailAsync(
                        recipient.User.Email,
                        recipient.User.FirstName,
                        entityName,
                        recipient.WasSaved,
                        recipient.WasInPlanner,
                        recipient.PlannerNotes);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to send saved item deletion email to {Email} for {EntityType} {EntityId}.",
                        recipient.User.Email,
                        entityType,
                        entityId);
                }
            }
        }

        private sealed record CleanupRecipient(
            Explorea.API.Models.User User,
            bool WasSaved,
            bool WasInPlanner,
            string? PlannerNote);
    }
}
