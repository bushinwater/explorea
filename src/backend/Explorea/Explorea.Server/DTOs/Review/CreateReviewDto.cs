namespace Explorea.API.DTOs.Review
{
    public class CreateReviewDto
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public List<string>? ImageUrls { get; set; }
    }
}
