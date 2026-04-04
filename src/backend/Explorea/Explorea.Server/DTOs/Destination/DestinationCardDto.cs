using Explorea.API.DTOs.Common;

namespace Explorea.API.DTOs.Destination
{
    public class DestinationCardDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public decimal AvgRating { get; set; }
        public bool IsFeatured {get; set; }
        public CityRefDto? City { get; set; }
        public LocationDto? Location { get; set; }
        public string? HeroImageUrl { get; set; }
        public int Popularity { get; set; }
        public CountryRefDto? Country { get; set; }
    }
}