using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Admin.Support
{
    public class AdminUpdateSupportTicketStatusDto
    {
        [Required, MaxLength(30)]
        public string Status { get; set; } = null!;
    }
}
