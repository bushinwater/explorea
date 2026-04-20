using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("popularity_logs")]
    public class PopularityLog
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid? UserId { get; set; }

        [MaxLength(64), Column("session_id")]
        public string? SessionId { get; set; }

        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!;

        [Column("entity_id")]
        public Guid EntityId { get; set; }

        [MaxLength(10), Column("source")]
        public string Source { get; set; } = "click";

        [Column("points")]
        public short Points { get; set; } = 1;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }
    }
}
