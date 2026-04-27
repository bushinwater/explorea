namespace Explorea.API.DTOs.Admin.Review
{
    public class AdminReviewListDto
    {
        public Guid            Id           { get; set; }
        public string          EntityType   { get; set; } = null!;
        public Guid            EntityId     { get; set; }
        public Guid            UserId       { get; set; }
        public string          UserFullName { get; set; } = null!;
        public string?         UserGender   { get; set; }
        public int?            UserAge      { get; set; }
        public short           Rating       { get; set; }
        public string?         Comment      { get; set; }
        public bool            IsHidden     { get; set; }
        public DateTimeOffset  CreatedAt    { get; set; }
    }
}
