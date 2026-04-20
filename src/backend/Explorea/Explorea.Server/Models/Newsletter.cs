using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("newsletter")]
    public class Newsletter
    {
        [Key]
        [Required]
        [MaxLength(255)]
        [Column("email")]
        public string Email { get; set; } = null!;

        [Column("subscribed")]
        public bool Subscribed { get; set; } = true;
    }
}