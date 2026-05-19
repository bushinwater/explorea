namespace Explorea.API.DTOs.Admin.Notification
{
    public class AdminBroadcastNotificationRequestDto
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Recipient { get; set; } = "all_users";
        public string? LinkUrl { get; set; }
    }

    public class AdminBroadcastNotificationResponseDto
    {
        public int SentCount { get; set; }
    }

    public class AdminNotificationInboxDto
    {
        public int UnreadCount { get; set; }
        public List<AdminNotificationItemDto> Items { get; set; } = new();
    }

    public class AdminNotificationItemDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? LinkUrl { get; set; }
        public bool IsRead { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
