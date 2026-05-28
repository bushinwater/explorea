using Explorea.API.DTOs.Admin.Queue;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using System.Text.Json;

namespace Explorea.Server.Services.Admin
{
    public class AdminQueueService : IAdminQueueService
    {
        private readonly ISubmissionQueueRepository _queueRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IAdminEventRepository _eventRepo;
        private readonly IEmailService _emailService;
        private readonly ILogger<AdminQueueService> _logger;
        public AdminQueueService(
            ISubmissionQueueRepository queueRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IAdminEventRepository eventRepo,
            IEmailService emailService,
            ILogger<AdminQueueService> logger)
        {
            _queueRepo      = queueRepo;
            _assignmentRepo = assignmentRepo;
            _eventRepo = eventRepo;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<(List<QueueItemDto> Items, int Total)> GetQueueAsync(
            Guid? destinationId, string? status, string? entityType, int page, int pageSize, Guid currentUserId)
        {
            // Ako je TO, može da vidi samo stavke za svoje destinacije
            if (destinationId.HasValue)
            {
                var hasAccess = await _assignmentRepo.ExistsAsync(currentUserId, destinationId.Value);
                if (!hasAccess)
                    return (new List<QueueItemDto>(), 0);
            }

            var (items, total) = await _queueRepo.GetPagedAsync(destinationId, status, entityType, page, pageSize);
            return (items.Select(MapToDto).ToList(), total);
        }

        public async Task<List<QueueItemDto>> GetOwnerQueueAsync(Guid currentUserId)
        {
            var items = await _queueRepo.GetPendingOwnerReviewAsync(currentUserId);
            return items.Select(MapToDto).ToList();
        }

        public async Task ApproveByTOAsync(Guid queueItemId, Guid reviewerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending items can be approved.");

            var hasAccess = await _assignmentRepo.ExistsAsync(reviewerId, item.DestinationId);
            if (!hasAccess)
                throw new Exception("Access denied.");

            item.Status             = "ApprovedByTO";
            item.ReviewedByTOUserId = reviewerId;
            item.ReviewedByTOAt     = DateTimeOffset.UtcNow;

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);

            if (eventEntity != null)
            {
                eventEntity.Visibility = "published";
                eventEntity.UpdatedAt = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy = reviewerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: true, reason: null);
        }

        public async Task RejectByTOAsync(Guid queueItemId, Guid reviewerId, string reason)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending items can be rejected.");

            var hasAccess = await _assignmentRepo.ExistsAsync(reviewerId, item.DestinationId);
            if (!hasAccess)
                throw new Exception("Access denied.");

            item.Status             = "RejectedByTO";
            item.ReviewedByTOUserId = reviewerId;
            item.ReviewedByTOAt     = DateTimeOffset.UtcNow;
            item.RejectionReason    = reason;

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);

            if (eventEntity != null)
            {
                eventEntity.Visibility = "rejected";
                eventEntity.UpdatedAt = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy = reviewerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: false, reason);
        }

        public async Task ApproveByOwnerAsync(Guid queueItemId, Guid ownerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "ApprovedByTO")
                throw new Exception("Item must be approved by TO before owner review.");

            item.Status              = "ApprovedByOwner";
            item.ReviewedByOwnerId   = ownerId;
            item.ReviewedByOwnerAt   = DateTimeOffset.UtcNow;

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: true, reason: null);
        }

        public async Task RejectByOwnerAsync(Guid queueItemId, Guid ownerId, string reason)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "ApprovedByTO")
                throw new Exception("Item must be approved by TO before owner review.");

            item.Status            = "RejectedByOwner";
            item.ReviewedByOwnerId = ownerId;
            item.ReviewedByOwnerAt = DateTimeOffset.UtcNow;
            item.RejectionReason   = reason;

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: false, reason);
        }

        private async Task NotifySubmitterAsync(
            Explorea.API.Models.SubmissionQueue item,
            bool approved,
            string? reason)
        {
            if (string.IsNullOrWhiteSpace(item.SubmittedByUser?.Email))
                return;

            var entityName = await ResolveEntityNameAsync(item)
                ?? item.Destination?.Name
                ?? "Vas zahtev";

            try
            {
                await _emailService.SendSubmittedEntityReviewedEmailAsync(
                    item.SubmittedByUser.Email,
                    item.SubmittedByUser.FirstName,
                    ResolveEntityTypeLabel(item.EntityType),
                    entityName,
                    approved,
                    reason);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to send submission review email to {Email} for queue item {QueueItemId}.",
                    item.SubmittedByUser.Email,
                    item.Id);
            }
        }

        private async Task<string?> ResolveEntityNameAsync(Explorea.API.Models.SubmissionQueue item)
        {
            if (item.EntityType.Equals("event", StringComparison.OrdinalIgnoreCase))
            {
                var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);
                if (!string.IsNullOrWhiteSpace(eventEntity?.Name))
                    return eventEntity.Name;
            }

            if (!string.IsNullOrWhiteSpace(item.RequestPayload))
            {
                try
                {
                    using var doc = JsonDocument.Parse(item.RequestPayload);
                    if (doc.RootElement.TryGetProperty("Name", out var name) &&
                        name.ValueKind == JsonValueKind.String)
                    {
                        return name.GetString();
                    }
                }
                catch (JsonException)
                {
                    return null;
                }
            }

            return null;
        }

        private static string ResolveEntityTypeLabel(string entityType)
        {
            return entityType.ToLowerInvariant() switch
            {
                "place" => "objekat",
                "event" => "dogadjaj",
                "activity" => "aktivnost",
                _ => "zahtev"
            };
        }

        private static QueueItemDto MapToDto(Explorea.API.Models.SubmissionQueue q) => new()
        {
            Id                = q.Id,
            EntityType        = q.EntityType,
            EntityId          = q.EntityId,
            DestinationId     = q.DestinationId,
            DestinationName   = q.Destination?.Name ?? "",
            LinkedPlaceId     = q.LinkedPlaceId,
            Status            = q.Status,
            SubmittedByUserId = q.SubmittedByUserId,
            SubmittedByName   = q.SubmittedByUser != null
                ? $"{q.SubmittedByUser.FirstName} {q.SubmittedByUser.LastName}"
                : "",
            SubmittedAt       = q.SubmittedAt,
            RejectionReason   = q.RejectionReason,
            ReviewedByTOAt    = q.ReviewedByTOAt,
            ReviewedByOwnerAt = q.ReviewedByOwnerAt
        };
    }
}
