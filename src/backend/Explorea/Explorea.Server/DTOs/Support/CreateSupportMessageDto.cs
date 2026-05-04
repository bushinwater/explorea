using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Support
{
    public class CreateSupportMessageDto
    {
        [Required]
        public string Content { get; set; } = null!;
    }
}
