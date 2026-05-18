namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityPageDto
    {
        public List<AdminRecentActivityDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
