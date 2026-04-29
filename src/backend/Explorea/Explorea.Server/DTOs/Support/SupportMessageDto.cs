namespace Explorea.API.DTOs.Support
{
    public class SupportMessageDto
    {
        public Guid Id { get; set; }
        public Guid TicketId { get; set; }
        public Guid SenderUserId { get; set; }
        public string SenderType { get; set; } = null!;
        public string? SenderName { get; set; }
        public string Content { get; set; } = null!;
        public bool IsInternal { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
