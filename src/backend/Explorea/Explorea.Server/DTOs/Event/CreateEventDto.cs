namespace Explorea.API.DTOs.Event
{
    public class CreateEventDto
    {
        public int? CityId { get; set; }
        public Guid? DestinationId { get; set; }
        public Guid? PlaceId { get; set; }
        public int TypeId { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public DateTimeOffset StartDatetime { get; set; }
        public DateTimeOffset EndDatetime { get; set; }
        public decimal? Price { get; set; }
        public string? Address { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? TicketUrl { get; set; }
        public bool IsFeatured { get; set; } = false;
    }
}