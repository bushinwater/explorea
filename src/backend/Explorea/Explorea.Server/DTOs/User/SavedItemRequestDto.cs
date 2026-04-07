namespace Explorea.API.DTOs.User
{
    public class SavedItemRequestDto
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
    }
}