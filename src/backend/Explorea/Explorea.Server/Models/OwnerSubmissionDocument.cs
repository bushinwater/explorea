using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("owner_submission_documents")]
    public class OwnerSubmissionDocument
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!;

        [Column("entity_id")]
        public Guid EntityId { get; set; }

        [Required, MaxLength(40), Column("document_type")]
        public string DocumentType { get; set; } = null!;

        [Required, MaxLength(1000), Column("document_url")]
        public string DocumentUrl { get; set; } = null!;

        [MaxLength(255), Column("file_name")]
        public string? FileName { get; set; }

        [MaxLength(100), Column("content_type")]
        public string? ContentType { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
