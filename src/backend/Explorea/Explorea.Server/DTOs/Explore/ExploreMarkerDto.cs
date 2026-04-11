namespace Explorea.API.DTOs.Explore
{
    public class ExploreMarkerDto
    {
        public string EntityType { get; set; } = null!;
        public Guid Id { get; set; }
        public string Slug { get; set; } = null!;
        public string Name { get; set; } = null!;
        public double Lat { get; set; }
        public double Lng { get; set; }
        public string? PreviewImageUrl { get; set; }
        public decimal? AvgRating { get; set; }

        // Podnaslov: grad za destinacije, tip za mesta, kategorija za aktivnosti, tip za dogadjaje
        public string? Subtitle { get; set; }

        // Samo za dogadjaje i aktivnosti
        public decimal? Price { get; set; }

        // Samo za dogadjaje
        public DateTimeOffset? StartDatetime { get; set; }
    }

    public class ExploreMapResultDto
    {
        public int Total { get; set; }
        public List<ExploreMarkerDto> Markers { get; set; } = new();
    }
}
