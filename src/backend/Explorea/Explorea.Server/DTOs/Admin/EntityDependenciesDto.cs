namespace Explorea.API.DTOs.Admin
{
    public class EntityDependenciesDto
    {
        public int EventCount { get; set; }
        public int PlaceCount { get; set; }
        public int ActivityCount { get; set; }
        public List<DependencyItemDto> Items { get; set; } = new();
        public int Total { get; set; }
    }

    public class DependencyItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public string? TypeLabel { get; set; }
        public string? City { get; set; }
        public decimal AvgRating { get; set; }
        public string EntityType { get; set; } = null!;
        public string? StartDate { get; set; }
        public string? ViaPlaceName { get; set; }
    }
}
