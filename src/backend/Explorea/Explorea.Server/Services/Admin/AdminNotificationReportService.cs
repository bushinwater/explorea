using Explorea.API.DTOs.Admin;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminNotificationReportService : IAdminNotificationReportService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;

        public AdminNotificationReportService(AppDbContext db, IEmailService emailService)
        {
            _db = db;
            _emailService = emailService;
        }

        public async Task<int> SendDueReportsAsync(DateTimeOffset now)
        {
            var users = await _db.Users
                .Include(user => user.Preferences)
                .Include(user => user.Role)
                .Where(user => user.IsActive)
                .Where(user => user.Preferences != null)
                .Where(user => user.Preferences!.NotificationsEnabled)
                .Where(user => user.Preferences!.EmailNotificationsEnabled)
                .Where(user => user.Preferences!.NotificationPriority == "all")
                .ToListAsync();

            var sentCount = 0;
            var localNow = ToBelgradeTime(now);

            foreach (var user in users)
            {
                var preferences = user.Preferences!;
                var topics = ParseTopics(preferences.NotificationReportTopics);

                if (preferences.NotificationDeliveryHour > localNow.Hour)
                    continue;

                if (topics.Count == 0 || !IsDue(preferences.NotificationReportsLastSentAt, preferences.NotificationDeliveryFrequencyDays, now))
                    continue;

                var reportData = await BuildReportDataAsync(user, preferences, now, topics);
                await _emailService.SendAdminReportEmailAsync(user.Email, reportData);

                preferences.NotificationReportsLastSentAt = now;
                preferences.UpdatedAt = now;
                sentCount += 1;
            }

            if (sentCount > 0)
                await _db.SaveChangesAsync();

            return sentCount;
        }

        public async Task<int> ForceSendReportAsync(Guid userId, DateTimeOffset now)
        {
            var user = await _db.Users
                .Include(u => u.Preferences)
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user?.Preferences == null) return 0;

            var preferences = user.Preferences;
            var topics = ParseTopics(preferences.NotificationReportTopics);

            if (topics.Count == 0)
                topics = new List<string> { "weekly_summary" };

            var reportData = await BuildReportDataAsync(user, preferences, now, topics);
            await _emailService.SendAdminReportEmailAsync(user.Email, reportData);

            preferences.NotificationReportsLastSentAt = now;
            preferences.UpdatedAt = now;
            await _db.SaveChangesAsync();

            return 1;
        }

        private async Task<AdminReportEmailData> BuildReportDataAsync(
            User user,
            UserPreferences prefs,
            DateTimeOffset now,
            List<string> topics)
        {
            var periodStart = now.AddDays(-prefs.NotificationDeliveryFrequencyDays);

            var data = new AdminReportEmailData
            {
                FirstName   = user.FirstName,
                Topics      = topics,
                PeriodStart = periodStart,
                PeriodEnd   = now,
            };

            var needsReviews = topics.Contains("reviews") || topics.Contains("weekly_summary");
            var needsEvents  = topics.Contains("events")  || topics.Contains("weekly_summary");
            var needsSystem  = topics.Contains("system")  || topics.Contains("weekly_summary");
            var needsUsers   = topics.Contains("weekly_summary");

            var isSuperAdmin   = user.Role?.Name == RoleNames.SuperAdmin;
            var isTO           = user.Role?.Name == RoleNames.TouristOrganization;
            var isPlaceOwner   = user.Role?.Name == RoleNames.PlaceOwner;
            int? managedRegion = user.ManagedRegionId;

            // For TO: precompute the set of entity IDs in their managed region so
            // we can scope reviews/events accordingly. SuperAdmin sees everything.
            // PlaceOwner sees only their own places/events.
            List<Guid>? scopedPlaceIds = null;
            List<Guid>? scopedEventIds = null;
            if (isTO && managedRegion.HasValue)
            {
                scopedPlaceIds = await _db.Places.AsNoTracking()
                    .Where(p => !p.IsDeleted && p.City != null && p.City.RegionId == managedRegion.Value)
                    .Select(p => p.Id).ToListAsync();
                scopedEventIds = await _db.Events.AsNoTracking()
                    .Where(e => !e.IsDeleted && e.City != null && e.City.RegionId == managedRegion.Value)
                    .Select(e => e.Id).ToListAsync();
            }
            else if (isPlaceOwner)
            {
                scopedPlaceIds = await _db.Places.IgnoreQueryFilters().AsNoTracking()
                    .Where(p => !p.IsDeleted && p.CreatedBy == user.Id)
                    .Select(p => p.Id).ToListAsync();
                scopedEventIds = await _db.Events.IgnoreQueryFilters().AsNoTracking()
                    .Where(e => !e.IsDeleted && e.CreatedBy == user.Id)
                    .Select(e => e.Id).ToListAsync();
            }

            if (needsReviews)
            {
                var reviewsQuery = _db.Reviews.AsNoTracking()
                    .Where(r => !r.IsDeleted && r.CreatedAt >= periodStart);
                if (!isSuperAdmin)
                {
                    var placeIds = scopedPlaceIds ?? new List<Guid>();
                    var eventIds = scopedEventIds ?? new List<Guid>();
                    reviewsQuery = reviewsQuery.Where(r =>
                        (r.EntityType == "place" && placeIds.Contains(r.EntityId)) ||
                        (r.EntityType == "event" && eventIds.Contains(r.EntityId)));
                }
                data.NewReviewsCount = await reviewsQuery.CountAsync();

                var hiddenQuery = _db.Reviews.AsNoTracking()
                    .Where(r => !r.IsDeleted && r.IsHidden);
                if (!isSuperAdmin)
                {
                    var placeIds = scopedPlaceIds ?? new List<Guid>();
                    var eventIds = scopedEventIds ?? new List<Guid>();
                    hiddenQuery = hiddenQuery.Where(r =>
                        (r.EntityType == "place" && placeIds.Contains(r.EntityId)) ||
                        (r.EntityType == "event" && eventIds.Contains(r.EntityId)));
                }
                data.HiddenReviewsCount = await hiddenQuery.CountAsync();
            }

            if (needsEvents)
            {
                var eventsQuery = _db.Events.AsNoTracking().Where(e => e.CreatedAt >= periodStart);
                var upcomingQuery = _db.Events.AsNoTracking().Where(e => e.StartDatetime > now);
                if (!isSuperAdmin)
                {
                    var eventIds = scopedEventIds ?? new List<Guid>();
                    eventsQuery = eventsQuery.Where(e => eventIds.Contains(e.Id));
                    upcomingQuery = upcomingQuery.Where(e => eventIds.Contains(e.Id));
                }
                data.NewEventsCount = await eventsQuery.CountAsync();
                data.UpcomingEventsCount = await upcomingQuery.CountAsync();
            }

            if (needsSystem)
            {
                var pendingPlacesQuery = _db.Places.AsNoTracking()
                    .Where(p => !p.IsDeleted && p.ApprovalStatus.ToLower() == "pending");
                if (!isSuperAdmin)
                {
                    var placeIds = scopedPlaceIds ?? new List<Guid>();
                    pendingPlacesQuery = pendingPlacesQuery.Where(p => placeIds.Contains(p.Id));
                }
                data.PendingPlacesCount = await pendingPlacesQuery.CountAsync();

                data.OpenTicketsCount = await _db.SupportTickets.AsNoTracking()
                    .CountAsync(t =>
                        (t.Status == SupportTicketStatuses.Open || t.Status == SupportTicketStatuses.InProgress) &&
                        (isSuperAdmin
                            ? (t.IsEscalated || t.AssignedToUserId == user.Id)
                            : t.AssignedToUserId == user.Id));
            }

            if (needsUsers && isSuperAdmin)
            {
                // Only SuperAdmin sees the global new-users count.
                data.NewUsersCount = await _db.Users.AsNoTracking()
                    .CountAsync(u => u.IsActive && u.CreatedAt >= periodStart);
            }

            return data;
        }

        private static DateTimeOffset ToBelgradeTime(DateTimeOffset now)
        {
            try
            {
                var timezone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
                return TimeZoneInfo.ConvertTime(now, timezone);
            }
            catch (TimeZoneNotFoundException)
            {
                return now.ToOffset(TimeSpan.FromHours(1));
            }
            catch (InvalidTimeZoneException)
            {
                return now.ToOffset(TimeSpan.FromHours(1));
            }
        }

        private static bool IsDue(DateTimeOffset? lastSentAt, int frequencyDays, DateTimeOffset now)
        {
            if (lastSentAt == null) return true;

            var normalizedFrequency = frequencyDays is 1 or 7 or 14 or 30 ? frequencyDays : 7;
            return lastSentAt.Value.AddDays(normalizedFrequency) <= now;
        }

        private static List<string> ParseTopics(string topics)
        {
            var normalized = topics
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(topic => topic is "reviews" or "events" or "system" or "weekly_summary")
                .Distinct()
                .ToList();

            return normalized.Contains("weekly_summary")
                ? new List<string> { "weekly_summary" }
                : normalized;
        }
    }
}
