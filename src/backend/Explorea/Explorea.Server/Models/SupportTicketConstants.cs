namespace Explorea.API.Models
{
    public static class SupportTicketStatuses
    {
        public const string Open = "open";
        public const string InProgress = "in_progress";
        public const string Resolved = "resolved";
        public const string Closed = "closed";

        public static readonly IReadOnlySet<string> All = new HashSet<string>
        {
            Open,
            InProgress,
            Resolved,
            Closed
        };
    }

    public static class SupportTicketPriorities
    {
        public const string Low = "low";
        public const string Medium = "medium";
        public const string High = "high";

        public static readonly IReadOnlySet<string> All = new HashSet<string>
        {
            Low,
            Medium,
            High
        };
    }

    public static class SupportSenderTypes
    {
        public const string User = "user";
        public const string ToAdmin = "to_admin";
        public const string SuperAdmin = "superadmin";

        public static readonly IReadOnlySet<string> All = new HashSet<string>
        {
            User,
            ToAdmin,
            SuperAdmin
        };
    }

    public static class SupportLinkedContextTypes
    {
        public const string Destination = "destination";
        public const string Place = "place";
        public const string Event = "event";
        public const string Activity = "activity";

        public static readonly IReadOnlySet<string> All = new HashSet<string>
        {
            Destination,
            Place,
            Event,
            Activity
        };
    }
}
