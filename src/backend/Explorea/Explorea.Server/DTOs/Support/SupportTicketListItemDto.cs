namespace Explorea.API.DTOs.Support
{
    public class SupportTicketListItemDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string Priority { get; set; } = null!;
        public Guid? OwnerUserId { get; set; }
        public string? OwnerName { get; set; }
        public Guid? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }
        public string? LinkedContextType { get; set; }
        public Guid? LinkedContextId { get; set; }
        public bool IsEscalated { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset LastActivityAt { get; set; }
        public int MessageCount { get; set; }
    }
}
