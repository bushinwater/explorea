using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("destination_images")]
    public class DestinationImage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("destination_id")]
        public Guid DestinationId { get; set; }

        [Required, MaxLength(500), Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [Column("sort_order")] public int  SortOrder { get; set; } = 0;
        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("DestinationId")]
        public Destination Destination { get; set; } = null!;
    }
}
