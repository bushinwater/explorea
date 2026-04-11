namespace Explorea.API.DTOs.Review
{
    public class ReviewDto
    {
        public Guid Id { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public ReviewUserDto User { get; set; } = null!;
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