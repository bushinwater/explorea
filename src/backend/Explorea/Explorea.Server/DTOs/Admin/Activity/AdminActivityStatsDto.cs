namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityStatsDto
    {
        public int TotalActivities { get; set; }
        public string? MostPopularName { get; set; }
        public int MostPopularViews { get; set; }
        public int InactiveCount { get; set; }
        public string? NewestName { get; set; }
        public DateTimeOffset? NewestCreatedAt { get; set; }
    }
}
