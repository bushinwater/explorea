namespace Explorea.API.DTOs.Admin.Support
{
    public class AdminSupportTicketQueryDto
    {
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
