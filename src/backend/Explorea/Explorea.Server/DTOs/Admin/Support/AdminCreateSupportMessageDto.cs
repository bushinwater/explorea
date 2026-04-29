using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Admin.Support
{
    public class AdminCreateSupportMessageDto
    {
        [Required]
        public string Content { get; set; } = null!;

        public bool IsInternal { get; set; } = false;
    }
}
