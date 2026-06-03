namespace Explorea.API.DTOs.Destination
{
    public class CityRefDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public int? RegionId { get; set; }
    }
}