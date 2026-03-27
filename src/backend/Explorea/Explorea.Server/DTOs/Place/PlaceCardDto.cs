namespace Explorea.API.DTOs.Place
{
    public class PlaceCardDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public TypeRefDto? Type { get; set; }
        public decimal AvgRating { get; set; }
        public string? Address { get; set; }
        public double? DistanceKm { get; set; }
        public string? PreviewImageUrl { get; set; }
        public bool IsOpen { get; set; }
        public string? PriceRange { get; set; }
    }
}