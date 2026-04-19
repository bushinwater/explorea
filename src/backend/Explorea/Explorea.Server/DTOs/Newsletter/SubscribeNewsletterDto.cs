using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Newsletter
{
    public class SubscribeNewsletterDto
    {
        [Required]
        [MaxLength(255)]
        public string Email { get; set; } = null!;
    }
}
