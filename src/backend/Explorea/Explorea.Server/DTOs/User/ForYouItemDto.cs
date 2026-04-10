namespace Explorea.API.DTOs.User
{
    public class ForYouItemDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public string? Subtitle { get; set; }
        public double AvgRating { get; set; }
        public int MatchedTagsCount { get; set; }
    }
}
