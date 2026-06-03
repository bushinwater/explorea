using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("account_appeals")]
    public class AccountAppeal
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(255), Column("email")]
        public string Email { get; set; } = null!;

        [Required, MaxLength(100), Column("first_name")]
        public string FirstName { get; set; } = null!;

        [Column("message")]
        public string? Message { get; set; }

        [Required, MaxLength(50), Column("status")]
        public string Status { get; set; } = "pending";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("reviewed_at")]
        public DateTimeOffset? ReviewedAt { get; set; }

        [Column("reviewed_by")]
        public Guid? ReviewedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
