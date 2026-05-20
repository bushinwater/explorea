using Explorea.API.DTOs.Admin.Queue;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminQueueService : IAdminQueueService
    {
        private readonly ISubmissionQueueRepository _queueRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IAdminEventRepository _eventRepo;
        public AdminQueueService(
            ISubmissionQueueRepository queueRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IAdminEventRepository eventRepo)
        {
            _queueRepo      = queueRepo;
            _assignmentRepo = assignmentRepo;
            _eventRepo = eventRepo;
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
