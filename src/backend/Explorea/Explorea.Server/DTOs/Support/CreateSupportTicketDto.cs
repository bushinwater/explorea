using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Support
{
    public class CreateSupportTicketDto
    {
        [Required, MaxLength(200)]
        public string Title { get; set; } = null!;

        [Required]
        public string Message { get; set; } = null!;

        [MaxLength(20)]
        public string? Priority { get; set; }

        [MaxLength(30)]
        public string? LinkedContextType { get; set; }

        public Guid? LinkedContextId { get; set; }

        public bool IsNonObjectRelated { get; set; } = false;
    }
}
