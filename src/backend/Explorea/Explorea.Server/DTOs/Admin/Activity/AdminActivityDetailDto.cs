namespace Explorea.API.DTOs.Admin.Activity
{
    public class ActivityImageItemDto
    {
        public Guid Id { get; set; }
        public string Url { get; set; } = null!;
        public int SortOrder { get; set; }
    }

    public class ActivityReviewDto
    {
        public Guid Id { get; set; }
        public string AuthorName { get; set; } = null!;
        public string? AuthorAvatarUrl { get; set; }
        public short Rating { get; set; }
        public string? Comment { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public List<string> ImageUrls { get; set; } = new();
    }

    public class AdminActivityDetailsDto
    {
        public Guid Id { get; set; }

        public int? CityId { get; set; }
        public string? CityName { get; set; }
        public Guid? DestinationId { get; set; }
        public Guid? PlaceId { get; set; }

        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = null!;
        public int? SeasonId { get; set; }
        public string? SeasonName { get; set; }
        public int? CountryId { get; set; }

        public int? RegionId { get; set; }
        public string? RegionName { get; set; }

        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }

        public decimal? Price { get; set; }
        public int? DurationMinutes { get; set; }

        public string? DifficultyLevel { get; set; }
        public decimal? DistanceKm { get; set; }
        public string? StartPoint { get; set; }

        public decimal AvgRating { get; set; }
        public int Popularity { get; set; }
        public int Views { get; set; }

        public string? ExtraData { get; set; }
        public Dictionary<string, string>? ExtraFilters { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public bool IsFeatured { get; set; }
        public bool IsActive { get; set; }

        public string? OrganizerWebsite { get; set; }
        public string? PreviewImageUrl { get; set; }

        public List<ActivityImageItemDto> Images { get; set; } = new();
        public List<string> Inclusions { get; set; } = new();
        public List<ActivityReviewDto> Reviews { get; set; } = new();

        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}