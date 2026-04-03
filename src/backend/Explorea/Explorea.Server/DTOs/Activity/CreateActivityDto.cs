namespace Explorea.API.DTOs.Activity
{
    public class CreateActivityDto
    {
        public int? CityId { get; set; }
        public Guid? DestinationId { get; set; }
        public Guid? PlaceId { get; set; }
        public int CategoryId { get; set; }
        public int? SeasonId { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public decimal? Price { get; set; }
        public int? DurationMinutes { get; set; }
        public string? DifficultyLevel { get; set; }
        public decimal? DistanceKm { get; set; }
        public string? StartPoint { get; set; }
        public bool IsFeatured { get; set; } = false;
        public int? CountryId { get; set; }
    }
}