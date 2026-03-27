namespace Explorea.API.DTOs.Search
{
    public class MapSearchItemDto
    {
        public string EntityType { get; set; } = null!;
        public MapEntityDto Entity { get; set; } = null!;
    }

    public class MapEntityDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public double Lat { get; set; }
        public double Lng { get; set; }
        public decimal? AvgRating { get; set; }
    }
}