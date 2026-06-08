using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("reviews")]
    public class Review
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

        [Column("rating")]
        public short Rating { get; set; }

        [Column("comment")]
        public string? Comment { get; set; }

        [Column("is_hidden")]  public bool IsHidden  { get; set; } = false;
        [Column("is_deleted")] public bool IsDeleted { get; set; } = false;
        [Column("deleted_at")] public DateTimeOffset? DeletedAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [Column("owner_reply")]
        public string? OwnerReply { get; set; }

        [Column("owner_reply_at")]
        public DateTimeOffset? OwnerReplyAt { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public ICollection<ReviewImage> Images { get; set; } = new List<ReviewImage>();
    }
}
