namespace Explorea.API.DTOs.Admin.Event
{
    public class AdminEventImageDto
    {
        public Guid   Id        { get; set; }
        public string ImageUrl  { get; set; } = null!;
        public int    SortOrder { get; set; }
    }
}
