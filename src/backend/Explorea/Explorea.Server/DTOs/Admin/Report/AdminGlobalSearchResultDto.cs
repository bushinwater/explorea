namespace Explorea.API.DTOs.Admin.Report
{
    public class AdminGlobalSearchResultDto
    {
        public string EntityType { get; set; } = "";
        public Guid   Id         { get; set; }
        public string Name       { get; set; } = "";
    }
}
