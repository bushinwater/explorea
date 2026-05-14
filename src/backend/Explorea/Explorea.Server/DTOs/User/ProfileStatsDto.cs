namespace Explorea.API.DTOs.User
{
    public class ProfileStatsDto
    {
        public int ReviewsCount { get; set; }
        public int SavedItemsCount { get; set; }
        public int PlannedEventsCount { get; set; }
        public DateTimeOffset MemberSince { get; set; }
    }
}