using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("notifications")]
    public class Notification
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(160), Column("title")]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(1200), Column("message")]
        public string Message { get; set; } = string.Empty;

        [MaxLength(1000), Column("link_url")]
        public string? LinkUrl { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("created_by")]
        public Guid? CreatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
