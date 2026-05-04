namespace Explorea.API.DTOs.Admin.Report
{
    public class ReportTemplateDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Parameters { get; set; } = null!;
        public DateTimeOffset CreatedAt { get; set; }
    }
}
