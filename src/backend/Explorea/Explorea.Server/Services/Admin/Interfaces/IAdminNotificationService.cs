using Explorea.API.DTOs.Admin.Notification;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminNotificationService
    {
        Task<AdminBroadcastNotificationResponseDto> BroadcastAsync(
            AdminBroadcastNotificationRequestDto dto,
            Guid currentUserId);
    }
}
