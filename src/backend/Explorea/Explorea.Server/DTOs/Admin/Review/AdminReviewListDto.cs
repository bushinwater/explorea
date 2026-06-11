namespace Explorea.API.DTOs.Admin.Review
{
    public class AdminReviewListDto
    {
        public Guid            Id                  { get; set; }
        public string          EntityType          { get; set; } = null!;
        public Guid            EntityId            { get; set; }
        public string?         EntityName          { get; set; }
        public string?         EntitySlug          { get; set; }
        public Guid            UserId              { get; set; }
        public string          UserFullName        { get; set; } = null!;
        public string?         UserGender          { get; set; }
        public int?            UserAge             { get; set; }
        public string?         UserProfileImageUrl { get; set; }
        public short           Rating              { get; set; }
        public string?         Comment             { get; set; }
        public bool             IsHidden            { get; set; }
        public DateTimeOffset   CreatedAt           { get; set; }
        public string?          OwnerReply          { get; set; }
        public DateTimeOffset?  OwnerReplyAt        { get; set; }
        public List<string>     ImageUrls           { get; set; } = new();
    }
}
