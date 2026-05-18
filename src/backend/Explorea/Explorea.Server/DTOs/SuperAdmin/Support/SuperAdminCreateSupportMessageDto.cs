using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.SuperAdmin.Support
{
    public class SuperAdminCreateSupportMessageDto
    {
        [Required]
        public string Content { get; set; } = null!;

        public bool IsInternal { get; set; } = false;
    }
}
