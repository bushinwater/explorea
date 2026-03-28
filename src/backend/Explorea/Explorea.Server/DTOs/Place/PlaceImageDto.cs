namespace Explorea.API.DTOs.Place
{
    public class PlaceImageDto
    {
        public string ImageUrl { get; set; } = null!;
        public string? Caption { get; set; }
        public int SortOrder { get; set; }
    }
}