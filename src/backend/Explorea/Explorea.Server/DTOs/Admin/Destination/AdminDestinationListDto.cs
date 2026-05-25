namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminDestinationListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public string? Region { get; set; }
        public int? RegionId { get; set; }
        public int? CityId { get; set; }
        public int Views { get; set; }
        public string Status { get; set; } = null!;
        public int? TypeId { get; set; }
        public string? TypeName { get; set; }
        public decimal AvgRating { get; set; }
        public bool IsFeatured { get; set; }
        public string Visibility { get; set; } = null!;
        public string? City { get; set; }
        public int? CountryId { get; set; }
        public string? Country { get; set; }
        public string? Description { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public List<AdminDestinationImageDto> Images { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public Dictionary<string, string>? ExtraFilters { get; set; }
    }
}
