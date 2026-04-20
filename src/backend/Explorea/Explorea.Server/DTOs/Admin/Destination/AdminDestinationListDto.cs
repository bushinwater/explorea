namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminDestinationListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public decimal AvgRating { get; set; }
        public bool IsFeatured { get; set; }
        public string Visibility { get; set; } = null!;
        public string? City { get; set; }
        public string? Country { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
