namespace Explorea.API.DTOs.Admin.Queue
{
    using Explorea.API.DTOs.Admin;

    public class QueueItemDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public Guid DestinationId { get; set; }
        public string DestinationName { get; set; } = null!;
        public Guid? LinkedPlaceId { get; set; }
        public bool SubmitterOwnsLinkedPlace { get; set; }
        public bool LinkedPlaceHasOwner { get; set; }
        public string Status { get; set; } = null!;
        public Guid SubmittedByUserId { get; set; }
        public string SubmittedByName { get; set; } = null!;
        public DateTimeOffset SubmittedAt { get; set; }
        public string? RejectionReason { get; set; }
        public DateTimeOffset? ReviewedByTOAt { get; set; }
        public DateTimeOffset? ReviewedByOwnerAt { get; set; }
        public List<OwnerSubmissionDocumentDto> Documents { get; set; } = new();
    }
}
