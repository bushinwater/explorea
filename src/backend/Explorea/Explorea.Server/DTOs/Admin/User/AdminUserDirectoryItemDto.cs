namespace Explorea.API.DTOs.Admin.User
{
    public class AdminUserDirectoryItemDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = null!;
        public int? RegionId { get; set; }
        public string? RegionName { get; set; }
        public int? CountryId { get; set; }
        public string Status { get; set; } = null!;
        public string Gender { get; set; } = "unknown";
        public int? Age { get; set; }
        public bool Flagged { get; set; }
        public DateTimeOffset? LastActivityAt { get; set; }
        public string? AvatarUrl { get; set; }
        public DateTimeOffset? DeletedAt { get; set; }
        public bool HasPendingAppeal { get; set; }
        public string? AppealMessage { get; set; }
    }
}
