namespace Explorea.API.DTOs.Admin.Report
{
    public class EntityTableRowDto
    {
        public string  Name       { get; set; } = null!;
        public string? SubType    { get; set; }
        public string? Location   { get; set; }
        public string? Region     { get; set; }
        public double  AvgRating  { get; set; }
        public long    Popularity { get; set; }
    }
}
