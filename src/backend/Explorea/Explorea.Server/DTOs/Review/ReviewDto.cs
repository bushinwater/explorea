namespace Explorea.API.DTOs.Review
{
    public class ReviewDto
    {
        public Guid Id { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public ReviewUserDto User { get; set; } = null!;
        public string? EntityType { get; set; }
        public string? EntityName { get; set; }
        public string? EntitySlug { get; set; }
        public string? OwnerReply { get; set; }
        public DateTimeOffset? OwnerReplyAt { get; set; }
    }

    public class ReviewUserDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string TravelerRank { get; set; } = null!;
        public string? ProfileImageUrl { get; set; }
    }
}