namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminPlaceListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public string? Type { get; set; }
        public string? City { get; set; }
        public string? Destination { get; set; }
        public decimal AvgRating { get; set; }
        public bool IsFeatured { get; set; }
        public string? Address { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}