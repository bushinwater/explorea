namespace Explorea.API.DTOs.User
{
    public class SavedItemDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public string? Subtitle { get; set; }
        public DateTimeOffset SavedAt { get; set; }
        public DateTimeOffset? EndDatetime { get; set; }
    }
}