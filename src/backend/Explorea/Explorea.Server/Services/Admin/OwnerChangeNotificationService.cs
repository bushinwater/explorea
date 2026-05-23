using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class OwnerChangeNotificationService : IOwnerChangeNotificationService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;
        private readonly ILogger<OwnerChangeNotificationService> _logger;

        public OwnerChangeNotificationService(
            AppDbContext db,
            IEmailService emailService,
            ILogger<OwnerChangeNotificationService> logger)
        {
            _db = db;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task NotifyOwnerAsync(
            Guid? ownerId,
            string entityType,
            string entityName,
            User actor,
            IReadOnlyCollection<string> changedFields)
        {
            if (!ownerId.HasValue ||
                ownerId.Value == actor.Id ||
                changedFields.Count == 0 ||
                (actor.Role.Name != RoleNames.SuperAdmin && actor.Role.Name != RoleNames.TouristOrganization))
            {
                return;
            }

            var owner = await _db.Users
                .Include(user => user.Role)
                .FirstOrDefaultAsync(user => user.Id == ownerId.Value);

            if (owner?.Role.Name != RoleNames.PlaceOwner ||
                string.IsNullOrWhiteSpace(owner.Email))
            {
                return;
            }

            try
            {
                await _emailService.SendOwnerEntityUpdatedEmailAsync(
                    owner.Email,
                    owner.FirstName,
                    entityType,
                    entityName,
                    FormatActor(actor),
                    changedFields);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to send owner change notification to {Email} for {EntityType} {EntityName}.",
                    owner.Email,
                    entityType,
                    entityName);
            }
        }

        private static string FormatActor(User actor)
        {
            var fullName = $"{actor.FirstName} {actor.LastName}".Trim();

            if (actor.Role.Name == RoleNames.TouristOrganization)
            {
                return actor.ManagedRegion != null
                    ? $"Turisticka organizacija {actor.ManagedRegion.Name}"
                    : (string.IsNullOrWhiteSpace(fullName) ? "Turisticka organizacija" : fullName);
            }

            return string.IsNullOrWhiteSpace(fullName) ? "administrator" : fullName;
        }
    }
}
