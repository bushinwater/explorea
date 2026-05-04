namespace Explorea.API.DTOs.SuperAdmin.Support
{
    public class SuperAdminSupportTicketQueryDto
    {
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public bool? IsEscalated { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
