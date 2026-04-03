namespace Explorea.API.DTOs.Place
{
    public class CreatePlaceDto
    {
        public int? CityId { get; set; }
        public Guid? DestinationId { get; set; }
        public int? TypeId { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public string? Address { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? PriceRange { get; set; }
        public string? Phone { get; set; }
        public string? WebsiteUrl { get; set; }
        public bool IsFeatured { get; set; } = false;
        public int? CountryId { get; set; }
    }
}