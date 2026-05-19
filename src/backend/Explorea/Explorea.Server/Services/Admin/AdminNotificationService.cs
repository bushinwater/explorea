using Explorea.API.DTOs.Admin.Notification;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminNotificationService : IAdminNotificationService
    {
        private static readonly HashSet<string> AllowedRecipients = new(StringComparer.OrdinalIgnoreCase)
        {
            "all_users",
            "super_admins",
            "tourist_organizations",
            "place_owners"
        };

        private readonly AppDbContext _db;
        private readonly IUserRepository _userRepository;
        private readonly IAdminActivityLogService _activityLogService;

        public AdminNotificationService(
            AppDbContext db,
            IUserRepository userRepository,
            IAdminActivityLogService activityLogService)
        {
            _db = db;
            _userRepository = userRepository;
            _activityLogService = activityLogService;
        }

        public async Task<AdminBroadcastNotificationResponseDto> BroadcastAsync(
            AdminBroadcastNotificationRequestDto dto,
            Guid currentUserId)
        {
            var currentUser = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (currentUser.Role.Name != RoleNames.SuperAdmin &&
                currentUser.Role.Name != RoleNames.TouristOrganization)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var title = dto.Title.Trim();
            var message = dto.Message.Trim();
            var recipient = dto.Recipient.Trim();
            var linkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : dto.LinkUrl.Trim();

            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Notification title is required.");

            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("Notification message is required.");

            if (!AllowedRecipients.Contains(recipient))
                throw new ArgumentException("Notification recipient is not supported.");

            var recipientIds = await BuildRecipientQuery(recipient)
                .Select(u => u.Id)
                .ToListAsync();

            var now = DateTimeOffset.UtcNow;
            var notifications = recipientIds.Select(userId => new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = title,
                Message = message,
                LinkUrl = linkUrl,
                IsRead = false,
                CreatedAt = now,
                CreatedBy = currentUserId
            });

            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync();

            await _activityLogService.LogAsync(
                "notification_broadcast_sent",
                $"Broadcast obavestenje poslato grupi {RecipientLabel(recipient)} ({recipientIds.Count} primalaca): {title}",
                currentUserId);

            return new AdminBroadcastNotificationResponseDto
            {
                SentCount = recipientIds.Count
            };
        }

        public async Task<AdminNotificationInboxDto> GetInboxAsync(Guid currentUserId, int take)
        {
            var normalizedTake = Math.Clamp(take, 1, 20);

            var unreadCount = await _db.Notifications
                .AsNoTracking()
                .CountAsync(notification => notification.UserId == currentUserId && !notification.IsRead);

            var items = await _db.Notifications
                .AsNoTracking()
                .Where(notification => notification.UserId == currentUserId)
                .OrderByDescending(notification => notification.CreatedAt)
                .Take(normalizedTake)
                .Select(notification => new AdminNotificationItemDto
                {
                    Id = notification.Id,
                    Title = notification.Title,
                    Message = notification.Message,
                    LinkUrl = notification.LinkUrl,
                    IsRead = notification.IsRead,
                    CreatedAt = notification.CreatedAt
                })
                .ToListAsync();

            return new AdminNotificationInboxDto
            {
                UnreadCount = unreadCount,
                Items = items
            };
        }

        public async Task MarkAsReadAsync(Guid currentUserId, Guid notificationId)
        {
            var notification = await _db.Notifications
                .FirstOrDefaultAsync(item => item.Id == notificationId && item.UserId == currentUserId);

            if (notification == null)
                throw new KeyNotFoundException("Notification was not found.");

            if (notification.IsRead)
                return;

            notification.IsRead = true;
            await _db.SaveChangesAsync();
        }

        public async Task MarkAllAsReadAsync(Guid currentUserId)
        {
            var notifications = await _db.Notifications
                .Where(notification => notification.UserId == currentUserId && !notification.IsRead)
                .ToListAsync();

            foreach (var notification in notifications)
            {
                notification.IsRead = true;
            }

            if (notifications.Count > 0)
            {
                await _db.SaveChangesAsync();
            }
        }

        private static string RecipientLabel(string recipient) => recipient.ToLowerInvariant() switch
        {
            "all_users" => "svi korisnici",
            "super_admins" => "svi super admini",
            "tourist_organizations" => "sve turisticke organizacije",
            "place_owners" => "svi vlasnici objekata",
            _ => recipient
        };

        private IQueryable<User> BuildRecipientQuery(string recipient)
        {
            var query = _db.Users
                .Include(u => u.Role)
                .Include(u => u.Preferences)
                .Where(u => u.IsActive)
                .Where(u => u.Preferences == null || u.Preferences.NotificationsEnabled);

            return recipient.ToLowerInvariant() switch
            {
                "all_users" => query,
                "super_admins" => query.Where(u => u.Role.Name == RoleNames.SuperAdmin),
                "tourist_organizations" => query.Where(u => u.Role.Name == RoleNames.TouristOrganization),
                "place_owners" => query.Where(u => u.Role.Name == RoleNames.PlaceOwner),
                _ => query.Where(_ => false)
            };
        }
    }
}
