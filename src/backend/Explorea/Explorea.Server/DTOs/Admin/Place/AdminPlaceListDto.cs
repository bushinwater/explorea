namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminPlaceListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public int? TypeId { get; set; }
        public string? Type { get; set; }
        public string? City { get; set; }
        public string? Region { get; set; }
        public string? Destination { get; set; }
        public decimal AvgRating { get; set; }
        public bool IsFeatured { get; set; }
        public bool HasRecentActivity { get; set; }
        public string? Address { get; set; }
        public string Status { get; set; } = "approved";
        public Guid? CreatedBy { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public DateTimeOffset? DeletedAt { get; set; }
    }
}