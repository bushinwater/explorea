using Explorea.Server.Data;
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
                .Where(user => user.IsActive)
                .Where(user => user.Preferences != null)
                .Where(user => user.Preferences!.EmailNotificationsEnabled)
                .Where(user => user.Preferences!.NotificationPriority == "all")
                .Where(user => user.Preferences!.NotificationDeliveryHour <= now.Hour)
                .ToListAsync();

            var sentCount = 0;

            foreach (var user in users)
            {
                var preferences = user.Preferences!;
                var topics = ParseTopics(preferences.NotificationReportTopics);

                if (topics.Count == 0 || !IsDue(preferences.NotificationReportsLastSentAt, preferences.NotificationDeliveryFrequencyDays, now))
                    continue;

                await _emailService.SendAdminReportEmailAsync(user.Email, user.FirstName, topics);

                preferences.NotificationReportsLastSentAt = now;
                preferences.UpdatedAt = now;
                sentCount += 1;
            }

            if (sentCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            return sentCount;
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
