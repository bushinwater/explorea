using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("event_images")]
    public class EventImage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("event_id")]
        public Guid EventId { get; set; }

        [Required, MaxLength(500), Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [MaxLength(300), Column("caption")]
        public string? Caption { get; set; }

        [Column("sort_order")] public int  SortOrder { get; set; } = 0;
        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("EventId")]
        public Event Event { get; set; } = null!;
    }
}
