using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("bug_reports")]
    public class BugReport
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid? UserId { get; set; }

        [Column("email"), MaxLength(255)]
        public string? Email { get; set; }

        [Required, MaxLength(500), Column("subject")]
        public string Subject { get; set; } = null!;

        [Required, Column("description")]
        public string Description { get; set; } = null!;

        [MaxLength(20), Column("status")]
        public string Status { get; set; } = "open";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
