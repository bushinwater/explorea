namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminMyPlaceDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string? PreviewImageUrl { get; set; }
        public decimal AvgRating { get; set; }
        public string Status { get; set; } = null!;
        public Guid? DestinationId { get; set; }
    }
}