namespace Explorea.API.DTOs.Admin.Report
{
    public class EntityProfileDto
    {
        public string Name          { get; set; } = "";
        public long   TotalViews    { get; set; }
        public double AvgRating     { get; set; }
        public int    ReviewCount   { get; set; }
        public int    PlaceCount    { get; set; }    // destinations only
        public int    ActivityCount { get; set; }    // destinations only
        public int    EventCount    { get; set; }    // destinations only
        public int    ViewsLast30   { get; set; }
        public int    ViewsPrev30   { get; set; }
    }
}
