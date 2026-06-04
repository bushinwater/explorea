using Explorea.API.DTOs.Admin.Queue;
using Explorea.API.DTOs.Admin;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
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
        private readonly IUserRepository _userRepo;
        private readonly AppDbContext _db;
        public AdminQueueService(
            ISubmissionQueueRepository queueRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IAdminEventRepository eventRepo,
            IEmailService emailService,
            ILogger<AdminQueueService> logger,
            IUserRepository userRepo,
            AppDbContext db)
        {
            _queueRepo      = queueRepo;
            _assignmentRepo = assignmentRepo;
            _eventRepo = eventRepo;
            _emailService = emailService;
            _logger = logger;
            _userRepo = userRepo;
            _db = db;
        }

        public async Task<(List<QueueItemDto> Items, int Total)> GetQueueAsync(
            Guid? destinationId, string? status, string? entityType, int page, int pageSize, Guid currentUserId)
        {
            // Ako je TO, može da vidi samo stavke za svoje destinacije
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                var ownerItems = await GetOwnerQueueAsync(currentUserId);
                var filteredOwnerItems = ownerItems
                    .Where(item =>
                        (!destinationId.HasValue || item.DestinationId == destinationId.Value) &&
                        (string.IsNullOrWhiteSpace(status) ||
                            item.Status == status ||
                            (status == "Pending" && item.Status == "ApprovedByTO")) &&
                        (string.IsNullOrWhiteSpace(entityType) || item.EntityType.Equals(entityType, StringComparison.OrdinalIgnoreCase)))
                    .ToList();

                return (
                    filteredOwnerItems.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
                    filteredOwnerItems.Count);
            }

            var restrictToDestinationIds = await ResolveReviewerDestinationScopeAsync(user, currentUserId);

            if (destinationId.HasValue)
            {
                if (restrictToDestinationIds != null && !restrictToDestinationIds.Contains(destinationId.Value))
                    return (new List<QueueItemDto>(), 0);
            }

            var (items, total) = await _queueRepo.GetPagedAsync(
                destinationId,
                status,
                entityType,
                page,
                pageSize,
                restrictToDestinationIds);
            var dtos = items.Select(MapToDto).ToList();
            await FillDocumentsAsync(dtos);
            await FillSubmitterOwnsPlaceAsync(dtos);
            return (dtos, total);
        }

        public async Task<List<QueueItemDto>> GetOwnerQueueAsync(Guid currentUserId)
        {
            var items = await _queueRepo.GetPendingOwnerReviewAsync(currentUserId);
            var dtos = items.Select(MapToDto).ToList();
            await FillDocumentsAsync(dtos);
            await FillSubmitterOwnsPlaceAsync(dtos);
            return dtos;
        }

        public async Task ApproveByTOAsync(Guid queueItemId, Guid reviewerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending items can be approved.");

            if (!await CanReviewAsAdminAsync(reviewerId, item.DestinationId))
                throw new Exception("Access denied.");

            var isOwnerSubmittingForOwnPlace = item.LinkedPlaceId.HasValue &&
                await _db.Places
                    .IgnoreQueryFilters()
                    .AnyAsync(p => p.Id == item.LinkedPlaceId.Value && p.CreatedBy == item.SubmittedByUserId);

            // If event targets a private place that is NOT owned by the submitter, TO must forward to owner first
            if (item.LinkedPlaceId.HasValue && !isOwnerSubmittingForOwnPlace)
            {
                var reviewerRole = await _db.Users
                    .Where(u => u.Id == reviewerId)
                    .Select(u => u.Role.Name)
                    .FirstOrDefaultAsync();
                if (reviewerRole == RoleNames.TouristOrganization)
                    throw new Exception("Dogadjaj je na tudjem objektu — morate ga proslediti vlasniku, ne mozete direktno odobriti.");
            }

            if (!isOwnerSubmittingForOwnPlace && !await HasRequiredOwnerDocumentsAsync(item))
                throw new Exception("Owner submission requires identity and authorization documents before approval.");

            // If submitter is the place owner OR there's no linked place (no owner step needed),
            // jump directly to ApprovedByOwner so the queue item is fully resolved
            item.Status = (isOwnerSubmittingForOwnPlace || !item.LinkedPlaceId.HasValue)
                ? "ApprovedByOwner"
                : "ApprovedByTO";
            item.ReviewedByTOUserId = reviewerId;
            item.ReviewedByTOAt     = DateTimeOffset.UtcNow;
            if (item.Status == "ApprovedByOwner")
            {
                item.ReviewedByOwnerId = reviewerId;
                item.ReviewedByOwnerAt = DateTimeOffset.UtcNow;
            }

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);

            if (eventEntity != null)
            {
                eventEntity.Visibility = "published";
                eventEntity.UpdatedAt = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy = reviewerId;
            }

            var placeEntity = await _db.Places
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(place => place.Id == item.EntityId);

            if (placeEntity != null)
            {
                placeEntity.ApprovalStatus = "approved";
                placeEntity.UpdatedAt = DateTimeOffset.UtcNow;
                placeEntity.UpdatedBy = reviewerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: true, reason: null);
        }

        public async Task ForwardToOwnerAsync(Guid queueItemId, Guid reviewerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending items can be forwarded to owner.");

            if (!await CanReviewAsAdminAsync(reviewerId, item.DestinationId))
                throw new Exception("Access denied.");

            if (!item.LinkedPlaceId.HasValue)
                throw new Exception("Ovaj dogadjaj nije vezan za konkretan objekat. Koristite Odobri za direktno objavljivanje.");

            item.Status             = "ApprovedByTO";
            item.ReviewedByTOUserId = reviewerId;
            item.ReviewedByTOAt     = DateTimeOffset.UtcNow;

            await _queueRepo.SaveChangesAsync();

            // Notify the place owner (not the submitter)
            var placeOwner = await _db.Users
                .Include(u => u.Role)
                .Where(u => _db.Places
                    .IgnoreQueryFilters()
                    .Any(p => p.Id == item.LinkedPlaceId.Value && p.CreatedBy == u.Id))
                .Select(u => new { u.Email, u.FirstName })
                .FirstOrDefaultAsync();

            if (placeOwner?.Email != null)
            {
                var entityName = await ResolveEntityNameAsync(item) ?? "Zahtev za dogadjaj";
                var submittedByName = item.SubmittedByUser != null
                    ? $"{item.SubmittedByUser.FirstName} {item.SubmittedByUser.LastName}".Trim()
                    : "Nepoznat korisnik";
                try
                {
                    await _emailService.SendOwnerReviewRequestEmailAsync(
                        placeOwner.Email,
                        placeOwner.FirstName ?? "Vlasnik",
                        ResolveEntityTypeLabel(item.EntityType),
                        entityName,
                        submittedByName);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send owner review request email for queue item {QueueItemId}.", item.Id);
                }
            }
        }

        public async Task RejectByTOAsync(Guid queueItemId, Guid reviewerId, string reason)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending items can be rejected.");

            if (!await CanReviewAsAdminAsync(reviewerId, item.DestinationId))
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

            var placeEntity = await _db.Places
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(place => place.Id == item.EntityId);

            if (placeEntity != null)
            {
                placeEntity.ApprovalStatus = "rejected";
                placeEntity.UpdatedAt = DateTimeOffset.UtcNow;
                placeEntity.UpdatedBy = reviewerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: false, reason);
        }

        public async Task DeleteAsync(Guid queueItemId, Guid reviewerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "Pending")
                throw new Exception("Only pending requests can be deleted.");

            if (item.SubmittedByUserId != reviewerId)
            {
                if (!await CanReviewAsAdminAsync(reviewerId, item.DestinationId))
                    throw new UnauthorizedAccessException("Access denied.");
            }

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);
            if (eventEntity != null)
            {
                eventEntity.IsDeleted = true;
                eventEntity.DeletedAt = DateTimeOffset.UtcNow;
                eventEntity.UpdatedAt = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy = reviewerId;
            }

            var placeEntity = await _db.Places
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(place => place.Id == item.EntityId);

            if (placeEntity != null)
            {
                placeEntity.IsDeleted = true;
                placeEntity.DeletedAt = DateTimeOffset.UtcNow;
                placeEntity.UpdatedAt = DateTimeOffset.UtcNow;
                placeEntity.UpdatedBy = reviewerId;
            }

            _db.SubmissionQueue.Remove(item);
            await _db.SaveChangesAsync();
        }

        public async Task ApproveByOwnerAsync(Guid queueItemId, Guid ownerId)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "ApprovedByTO")
                throw new Exception("Item must be approved by TO before owner review.");

            if (!await CanReviewAsOwnerAsync(ownerId, item.LinkedPlaceId))
                throw new Exception("Access denied.");

            item.Status              = "ApprovedByOwner";
            item.ReviewedByOwnerId   = ownerId;
            item.ReviewedByOwnerAt   = DateTimeOffset.UtcNow;

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);
            if (eventEntity != null)
            {
                eventEntity.Visibility = "published";
                eventEntity.UpdatedAt  = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy  = ownerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: true, reason: null);
        }

        public async Task RejectByOwnerAsync(Guid queueItemId, Guid ownerId, string reason)
        {
            var item = await _queueRepo.GetByIdAsync(queueItemId)
                ?? throw new Exception("Queue item not found.");

            if (item.Status != "ApprovedByTO")
                throw new Exception("Item must be approved by TO before owner review.");

            if (!await CanReviewAsOwnerAsync(ownerId, item.LinkedPlaceId))
                throw new Exception("Access denied.");

            item.Status            = "RejectedByOwner";
            item.ReviewedByOwnerId = ownerId;
            item.ReviewedByOwnerAt = DateTimeOffset.UtcNow;
            item.RejectionReason   = reason;

            var eventEntity = await _eventRepo.GetAdminByIdAsync(item.EntityId);
            if (eventEntity != null)
            {
                eventEntity.Visibility = "rejected";
                eventEntity.UpdatedAt  = DateTimeOffset.UtcNow;
                eventEntity.UpdatedBy  = ownerId;
            }

            await _queueRepo.SaveChangesAsync();
            await NotifySubmitterAsync(item, approved: false, reason);
        }

        private async Task<IReadOnlyCollection<Guid>?> ResolveReviewerDestinationScopeAsync(
            Explorea.API.Models.User user,
            Guid userId)
        {
            if (user.Role.Name == RoleNames.SuperAdmin)
                return null;

            if (user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            if (user.ManagedRegionId.HasValue)
            {
                return await _db.Destinations
                    .IgnoreQueryFilters()
                    .Where(destination =>
                        !destination.IsDeleted &&
                        destination.City != null &&
                        destination.City.RegionId == user.ManagedRegionId.Value)
                    .Select(destination => destination.Id)
                    .ToListAsync();
            }

            var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
            return assignments.Select(assignment => assignment.DestinationId).ToList();
        }

        private async Task<bool> CanReviewAsAdminAsync(Guid reviewerId, Guid destinationId)
        {
            var reviewer = await _userRepo.GetByIdWithRoleAsync(reviewerId);
            if (reviewer?.Role.Name == RoleNames.SuperAdmin)
                return true;

            if (reviewer?.Role.Name != RoleNames.TouristOrganization)
                return false;

            if (reviewer.ManagedRegionId.HasValue)
            {
                return await _db.Destinations
                    .IgnoreQueryFilters()
                    .AnyAsync(destination =>
                        destination.Id == destinationId &&
                        !destination.IsDeleted &&
                        destination.City != null &&
                        destination.City.RegionId == reviewer.ManagedRegionId.Value);
            }

            return await _assignmentRepo.ExistsAsync(reviewerId, destinationId);
        }

        private async Task<bool> HasRequiredOwnerDocumentsAsync(Explorea.API.Models.SubmissionQueue item)
        {
            if (!item.EntityType.Equals("place", StringComparison.OrdinalIgnoreCase) &&
                !item.EntityType.Equals("event", StringComparison.OrdinalIgnoreCase))
                return true;

            var submitter = await _userRepo.GetByIdWithRoleAsync(item.SubmittedByUserId);
            if (submitter?.Role.Name != RoleNames.PlaceOwner)
                return true;

            // Check if user has uploaded required documents for this entity OR any of their entities
            var documentTypes = await _db.OwnerSubmissionDocuments
                .Where(document => document.UserId == item.SubmittedByUserId)
                .Select(document => document.DocumentType)
                .Distinct()
                .ToListAsync();

            return documentTypes.Contains("identity") && documentTypes.Contains("authorization");
        }

        private async Task<bool> CanReviewAsOwnerAsync(Guid ownerId, Guid? linkedPlaceId)
        {
            if (!linkedPlaceId.HasValue)
                return false;

            return await _db.Places
                .IgnoreQueryFilters()
                .AnyAsync(place => place.Id == linkedPlaceId.Value && place.CreatedBy == ownerId);
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

            if (item.EntityType.Equals("place", StringComparison.OrdinalIgnoreCase))
            {
                var placeName = await _db.Places
                    .IgnoreQueryFilters()
                    .Where(place => place.Id == item.EntityId)
                    .Select(place => place.Name)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrWhiteSpace(placeName))
                    return placeName;
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

        private async Task FillSubmitterOwnsPlaceAsync(List<QueueItemDto> items)
        {
            var withPlace = items.Where(i => i.LinkedPlaceId.HasValue).ToList();
            if (withPlace.Count == 0) return;

            var pairs = withPlace.Select(i => new { i.LinkedPlaceId, i.SubmittedByUserId }).ToList();
            var ownedPairs = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => withPlace.Select(i => i.LinkedPlaceId!.Value).Contains(p.Id))
                .Select(p => new { PlaceId = p.Id, p.CreatedBy })
                .ToListAsync();

            foreach (var item in withPlace)
            {
                item.SubmitterOwnsLinkedPlace = ownedPairs.Any(p =>
                    p.PlaceId == item.LinkedPlaceId!.Value && p.CreatedBy == item.SubmittedByUserId);
            }
        }

        private async Task FillDocumentsAsync(List<QueueItemDto> items)
        {
            if (items.Count == 0)
                return;

            var entityIds = items.Select(i => i.EntityId).Distinct().ToList();
            var documents = await _db.OwnerSubmissionDocuments
                .Where(document => entityIds.Contains(document.EntityId))
                .OrderBy(document => document.CreatedAt)
                .Select(document => new
                {
                    document.EntityType,
                    document.EntityId,
                    Dto = new OwnerSubmissionDocumentDto
                    {
                        Id = document.Id,
                        DocumentType = document.DocumentType,
                        DocumentUrl = BuildDocumentDeliveryUrl(document.DocumentUrl),
                        FileName = document.FileName,
                        ContentType = document.ContentType,
                        CreatedAt = document.CreatedAt
                    }
                })
                .ToListAsync();

            foreach (var item in items)
            {
                item.Documents = documents
                    .Where(document =>
                        document.EntityId == item.EntityId &&
                        document.EntityType.Equals(item.EntityType, StringComparison.OrdinalIgnoreCase))
                    .Select(document => document.Dto)
                    .ToList();
            }
        }

        private static string BuildDocumentDeliveryUrl(string url)
        {
            return url.Replace("/upload/fl_attachment/", "/upload/");
        }
    }
}
