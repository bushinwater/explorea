namespace Explorea.API.DTOs.Review
{
    public class UpdateReviewDto
    {
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public List<string>? ImageUrls { get; set; }
    }
}
