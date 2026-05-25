namespace Explorea.API.DTOs.Admin.User
{
    public class AdminUserDirectoryQueryDto
    {
        public string? Search { get; set; }
        public string? Role { get; set; }
        public int? RegionId { get; set; }
        public string? Status { get; set; }
        public string? ActivityStatus { get; set; }
        public string? Gender { get; set; }
        public string? AgeBucket { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
