namespace Explorea.API.DTOs.Support
{
    public class SupportTicketDetailDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string Priority { get; set; } = null!;
        public Guid? OwnerUserId { get; set; }
        public string? OwnerName { get; set; }
        public Guid? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }
        public Guid? CreatedByAdminId { get; set; }
        public string? CreatedByAdminName { get; set; }
        public string? LinkedContextType { get; set; }
        public Guid? LinkedContextId { get; set; }
        public bool IsEscalated { get; set; }
        public DateTimeOffset? EscalatedAt { get; set; }
        public Guid? EscalatedByUserId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset LastActivityAt { get; set; }
        public DateTimeOffset? ResolvedAt { get; set; }
        public DateTimeOffset? ClosedAt { get; set; }
        public List<SupportMessageDto> Messages { get; set; } = new();
    }
}
