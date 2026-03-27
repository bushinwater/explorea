using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("visits")]
    public class Visit
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        // destination | place | event | activity
        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!;

        [Column("entity_id")]
        public Guid EntityId { get; set; }

        [Column("visited_at")] public DateTimeOffset VisitedAt { get; set; }

        // manual | review_auto
        [Required, MaxLength(20), Column("source_type")]
        public string SourceType { get; set; } = "manual";

        [MaxLength(300), Column("note")]
        public string? Note { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
