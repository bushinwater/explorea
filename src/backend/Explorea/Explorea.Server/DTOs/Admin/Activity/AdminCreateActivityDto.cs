namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminCreateActivityDto
    {
        public int? CityId { get; set; }
        public Guid? DestinationId { get; set; }
        public Guid? PlaceId { get; set; }

        public int CategoryId { get; set; }
        public int? SeasonId { get; set; }
        public int? CountryId { get; set; }

        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }

        public decimal? Price { get; set; }
        public int? DurationMinutes { get; set; }

        public string? DifficultyLevel { get; set; }
        public decimal? DistanceKm { get; set; }
        public string? StartPoint { get; set; }

        public string? ExtraData { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public int Popularity { get; set; } = 0;
        public bool IsFeatured { get; set; } = false;
        public bool IsActive { get; set; } = true;

        public string? OrganizerWebsite { get; set; }
    }
}