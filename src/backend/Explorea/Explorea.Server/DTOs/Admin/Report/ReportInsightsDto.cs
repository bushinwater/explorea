namespace Explorea.API.DTOs.Admin.Report
{
    public class ReportInsightsDto
    {
        public long MonthlyTraffic { get; set; }
        public string? MostPopularDestination { get; set; }
        public double AvgRating { get; set; }
    }
}
