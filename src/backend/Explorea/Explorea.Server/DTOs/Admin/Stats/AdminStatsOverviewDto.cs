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

    public class AdminTrafficPointDto
    {
        public string Date { get; set; } = string.Empty;
        public int Views { get; set; }
    }

    public class AdminSystemStatusItemDto
    {
        public string Label { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public string? DetailKey { get; set; }
        public string Level { get; set; } = "ok";
        public int? Percentage { get; set; }
    }

    public class AdminPendingCountDto
    {
        public int Count { get; set; }
        public int EventCount { get; set; }
        public int PlaceCount { get; set; }
    }

    public class AdminLastServerErrorDto
    {
        public string Message { get; set; } = string.Empty;
        public string ExceptionType { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public string Method { get; set; } = string.Empty;
        public DateTimeOffset OccurredAt { get; set; }
    }
}
