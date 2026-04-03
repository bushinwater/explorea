using Explorea.API.DTOs.Common;

namespace Explorea.API.DTOs.Activity
{
    public class ActivityCardDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public CategoryRefDto? Category { get; set; }
        public decimal AvgRating { get; set; }
        public int? DurationMinutes { get; set; }
        public decimal? Price { get; set; }
        public string? DifficultyLevel { get; set; }
        public string? PreviewImageUrl { get; set; }
        public int Popularity { get; set; }
        public CountryRefDto? Country { get; set; }
    }
}