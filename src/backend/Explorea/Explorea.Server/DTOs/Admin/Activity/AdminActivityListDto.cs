namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityListDto
    {
        public Guid Id { get; set; }

        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;

        public string? Description { get; set; }

        public string Category { get; set; } = null!;
        public int CategoryId { get; set; }

        public string? City { get; set; }
        public int? CityId { get; set; }

        public string? Region { get; set; }
        public int? RegionId { get; set; }

        public string? Destination { get; set; }
        public Guid? DestinationId { get; set; }

        public decimal? Price { get; set; }
        public int? DurationMinutes { get; set; }
        public string? DurationGroup { get; set; }

        public string? DifficultyLevel { get; set; }
        public decimal? DistanceKm { get; set; }
        public string? StartPoint { get; set; }

        public decimal AvgRating { get; set; }
        public int Popularity { get; set; }

        public bool IsFeatured { get; set; }
        public bool IsActive { get; set; }

        public string? PreviewImageUrl { get; set; }

        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public DateTimeOffset? DeletedAt { get; set; }
        /// <summary>
        /// True when at least one popularity-log event hit this activity in the last 30 days,
        /// or when the activity was created within that same window. Drives the
        /// "Aktivno / Neaktivno" status pill in the admin table.
        /// </summary>
        public bool HasRecentActivity { get; set; }
    }
}