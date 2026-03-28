namespace Explorea.API.DTOs.Event
{
    public class EventImageDto
    {
        public string ImageUrl { get; set; } = null!;
        public string? Caption { get; set; }
        public int SortOrder { get; set; }
    }
}