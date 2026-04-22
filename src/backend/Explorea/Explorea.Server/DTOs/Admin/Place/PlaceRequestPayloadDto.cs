namespace Explorea.API.DTOs.Admin.Place
{
    public class PlaceRequestPayloadDto
    {
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public string? Address { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public List<string> Images { get; set; } = new();
        public List<string> Documents { get; set; } = new();
        public int? TypeId { get; set; }
        public int? CityId { get; set; }
    }
}