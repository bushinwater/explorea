namespace Explorea.API.DTOs.BugReport
{
    public class CreateBugReportDto
    {
        public string Subject { get; set; } = null!;
        public string Description { get; set; } = null!;
        public string? Email { get; set; }
    }
}
