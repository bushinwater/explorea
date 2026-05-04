namespace Explorea.API.DTOs.Admin.Report
{
    public class ReportDataPointDto
    {
        public string Date { get; set; } = null!;
        public long? Traffic { get; set; }
        public double? ConversionRate { get; set; }
        public long? UserGrowth { get; set; }
        public long? Reviews { get; set; }
        public long? Requests { get; set; }
    }
}
