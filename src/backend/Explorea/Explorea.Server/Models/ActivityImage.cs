using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("activity_images")]
    public class ActivityImage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("activity_id")]
        public Guid ActivityId { get; set; }

        [Required, MaxLength(500), Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [Column("sort_order")] public int  SortOrder { get; set; } = 0;
        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("ActivityId")]
        public Activity Activity { get; set; } = null!;
    }
}
