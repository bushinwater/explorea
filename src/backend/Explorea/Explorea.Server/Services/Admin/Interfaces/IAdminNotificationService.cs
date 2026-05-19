using Explorea.API.DTOs.Admin.Notification;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminNotificationService
    {
        Task<AdminBroadcastNotificationResponseDto> BroadcastAsync(
            AdminBroadcastNotificationRequestDto dto,
            Guid currentUserId);
        Task<AdminNotificationInboxDto> GetInboxAsync(Guid currentUserId, int take);
        Task MarkAsReadAsync(Guid currentUserId, Guid notificationId);
        Task MarkAllAsReadAsync(Guid currentUserId);
    }
}
