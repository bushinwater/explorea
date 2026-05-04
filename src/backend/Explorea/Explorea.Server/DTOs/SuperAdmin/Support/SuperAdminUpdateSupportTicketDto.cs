using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.SuperAdmin.Support
{
    public class SuperAdminUpdateSupportTicketDto
    {
        [MaxLength(30)]
        public string? Status { get; set; }

        [MaxLength(20)]
        public string? Priority { get; set; }
    }
}
