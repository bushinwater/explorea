namespace Explorea.API.DTOs.Admin.Report
{
    public class DestinationsTableItemDto
    {
        public string  Name       { get; set; } = null!;
        public string? City       { get; set; }
        public string? Region     { get; set; }
        public string? Type       { get; set; }
        public double  AvgRating  { get; set; }
        public long    Popularity { get; set; }
    }
}
