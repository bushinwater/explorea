namespace Explorea.API.DTOs.Admin.Report
{
    public class ReportInsightsDto
    {
        public string? TopRegion         { get; set; }
        public long    NewUsersThisMonth { get; set; }
        public string? TopEntityType     { get; set; }
    }
}
