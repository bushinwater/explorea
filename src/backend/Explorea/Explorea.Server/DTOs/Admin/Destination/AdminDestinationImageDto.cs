namespace Explorea.API.DTOs.Admin.Destination
{
    public class AdminDestinationImageDto
    {
        public Guid Id { get; set; }
        public string ImageUrl { get; set; } = null!;
        public int SortOrder { get; set; }
    }
}
