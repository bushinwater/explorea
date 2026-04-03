namespace Explorea.API.DTOs.Destination
{
    public class CreateDestinationDto
    {
        public int? CityId { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? PreviewImageUrl { get; set; }
        public bool IsFeatured { get; set; } = false;
        public int? CountryId { get; set; }
        public string? HeroImageUrl { get; set; }
    }
}