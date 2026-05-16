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
}
