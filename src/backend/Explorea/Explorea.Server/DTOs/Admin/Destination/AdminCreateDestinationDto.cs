namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminCreateDestinationDto
    {
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public string? Address { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public int? CityId { get; set; }
        public int? RegionId { get; set; }
        public int? CountryId { get; set; }
        public string? HeroImageUrl { get; set; }
        public string Visibility { get; set; } = "draft";
        public int? TypeId { get; set; }
        public Dictionary<string, string>? ExtraFilters { get; set; }
    }
}
