namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminUpdateDestinationDto
    {
        public string? Name { get; set; }
        public string? Slug { get; set; }
        public string? Description { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? CityId { get; set; }
        public int? RegionId { get; set; }
        public int? CountryId { get; set; }
        public string? HeroImageUrl { get; set; }
        public string? Visibility { get; set; }
        public int? TypeId { get; set; }
        public bool ClearTypeId { get; set; } = false;
        public bool ClearRegionId { get; set; } = false;
        public bool ClearCountryId { get; set; } = false;
        public Dictionary<string, string>? ExtraFilters { get; set; }
    }
}
