using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("place_images")]
    public class PlaceImage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("place_id")]
        public Guid PlaceId { get; set; }

        [Required, MaxLength(500), Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [MaxLength(300), Column("caption")]
        public string? Caption { get; set; }

        [Column("sort_order")] public int  SortOrder { get; set; } = 0;
        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("PlaceId")]
        public Place Place { get; set; } = null!;
    }
}
