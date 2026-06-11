using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("review_images")]
    public class ReviewImage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("review_id")]
        public Guid ReviewId { get; set; }

        [Required, Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [Column("sort_order")]
        public int SortOrder { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [ForeignKey(nameof(ReviewId))]
        public Review Review { get; set; } = null!;
    }
}
