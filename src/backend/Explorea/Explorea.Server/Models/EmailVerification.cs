using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("email_verifications")]
    public class EmailVerification
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(255), Column("email")]
        public string Email { get; set; } = null!;

        [Required, MaxLength(512), Column("token_hash")]
        public string TokenHash { get; set; } = null!;

        [Column("expires_at")]  public DateTimeOffset  ExpiresAt  { get; set; }
        [Column("verified_at")] public DateTimeOffset? VerifiedAt { get; set; }
        [Column("created_at")]  public DateTimeOffset  CreatedAt  { get; set; }
        [Column("updated_at")]  public DateTimeOffset  UpdatedAt  { get; set; }
        [Column("created_by")]  public Guid?           CreatedBy  { get; set; }
        [Column("updated_by")]  public Guid?           UpdatedBy  { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
