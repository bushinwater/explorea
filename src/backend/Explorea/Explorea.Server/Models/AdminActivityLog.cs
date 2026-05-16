using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("admin_activity_log")]
    public class AdminActivityLog
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Required, MaxLength(80), Column("type")]
        public string Type { get; set; } = string.Empty;

        [Required, MaxLength(500), Column("description")]
        public string Description { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("actor_id")]
        public Guid? ActorId { get; set; }

        [ForeignKey("ActorId")]
        public User? Actor { get; set; }
    }
}
