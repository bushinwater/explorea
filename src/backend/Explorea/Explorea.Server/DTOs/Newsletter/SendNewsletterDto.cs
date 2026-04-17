using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Newsletter
{
    public class SendNewsletterDto
    {
        [Required]
        [MaxLength(200)]
        public string Subject { get; set; } = null!;

        [Required]
        public string HtmlBody { get; set; } = null!;
    }
}
