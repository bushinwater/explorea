using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("user_auth_accounts")]
    public class UserAuthAccount
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(50), Column("provider")]
        public string Provider { get; set; } = null!;

        [MaxLength(255), Column("provider_user_id")]
        public string? ProviderUserId { get; set; }

        [MaxLength(255), Column("email_at_provider")]
        public string? EmailAtProvider { get; set; }

        [Column("is_primary")]
        public bool IsPrimary { get; set; } = false;

        [Column("access_token")]  public string? AccessToken  { get; set; }
        [Column("refresh_token")] public string? RefreshToken { get; set; }

        [Column("token_expires_at")]
        public DateTimeOffset? TokenExpiresAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
