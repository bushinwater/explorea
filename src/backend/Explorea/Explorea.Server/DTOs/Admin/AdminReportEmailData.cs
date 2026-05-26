namespace Explorea.API.DTOs.Admin
{
    public class AdminReportEmailData
    {
        public string FirstName { get; set; } = string.Empty;
        public List<string> Topics { get; set; } = new();
        public DateTimeOffset PeriodStart { get; set; }
        public DateTimeOffset PeriodEnd { get; set; }

        // reviews
        public int NewReviewsCount { get; set; }
        public int HiddenReviewsCount { get; set; }

        // events
        public int NewEventsCount { get; set; }
        public int UpcomingEventsCount { get; set; }

        // system
        public int PendingPlacesCount { get; set; }
        public int OpenTicketsCount { get; set; }

        // weekly_summary
        public int NewUsersCount { get; set; }
    }
}
