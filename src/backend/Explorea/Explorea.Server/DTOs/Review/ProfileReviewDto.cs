namespace Explorea.API.DTOs.Review
{
    public class ProfileReviewDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public string EntityName { get; set; } = null!;
        public string? EntitySlug { get; set; }
        public string? PreviewImageUrl { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}