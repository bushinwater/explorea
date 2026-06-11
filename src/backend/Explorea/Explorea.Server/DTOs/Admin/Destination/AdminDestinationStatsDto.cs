namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminDestinationStatsDto
    {
        public long TotalViews { get; set; }
        public int ActiveCount { get; set; }
        public int DeletedCount { get; set; }
        public int InactiveCount { get; set; }
        public int AddedLast30Days { get; set; }
        public string MostPopularName { get; set; } = string.Empty;
        public int MostPopularViews { get; set; }
        public List<AdminDestinationTopItemDto> TopDestinations { get; set; } = new();
    }

    public class AdminDestinationTopItemDto
    {
        public string Name { get; set; } = string.Empty;
        public int Views { get; set; }
    }
}
