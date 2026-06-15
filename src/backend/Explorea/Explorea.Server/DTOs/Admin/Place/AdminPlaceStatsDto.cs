namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminPlaceStatsDto
    {
        public int TotalCount { get; set; }
        public int ActiveCount { get; set; }
        public int PendingCount { get; set; }
        public int InactiveCount { get; set; }
        public int DeletedCount { get; set; }
        public int AddedLast30Days { get; set; }
        public List<AdminPlaceTopItemDto> TopPlaces { get; set; } = new();
    }

    public class AdminPlaceTopItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public decimal AvgRating { get; set; }
        public int ReviewCount { get; set; }
    }
}
