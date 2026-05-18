namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminRecentActivityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public Guid? ActorId { get; set; }
    }
}
