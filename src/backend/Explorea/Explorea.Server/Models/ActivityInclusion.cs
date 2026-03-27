using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("activity_inclusions")]
    public class ActivityInclusion
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("activity_id")]
        public Guid ActivityId { get; set; }

        [Required, MaxLength(200), Column("item")]
        public string Item { get; set; } = null!;

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("ActivityId")]
        public Activity Activity { get; set; } = null!;
    }
}
