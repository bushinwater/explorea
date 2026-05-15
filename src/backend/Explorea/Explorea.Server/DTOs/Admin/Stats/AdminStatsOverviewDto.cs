namespace Explorea.API.DTOs.Admin.Stats
{
    public class AdminStatsOverviewDto
    {
        public int TotalUsers { get; set; }
        public int NewUsersLast30Days { get; set; }
        public int ActiveDestinations { get; set; }
        public AdminPopularEntityDto? MostPopularDestination { get; set; }
        public AdminPopularEntityDto? MostPopularEntity { get; set; }
    }

    public class AdminPopularEntityDto
    {
        public string EntityType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Views { get; set; }
    }
}
