using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("refresh_tokens")]
    public class RefreshToken
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(512), Column("token_hash")]
        public string TokenHash { get; set; } = null!;

        [Column("expires_at")]    public DateTimeOffset  ExpiresAt   { get; set; }
        [Column("created_at")]    public DateTimeOffset  CreatedAt   { get; set; }
        [Column("created_by_ip")] public string?         CreatedByIp { get; set; }
        [Column("revoked_at")]    public DateTimeOffset? RevokedAt   { get; set; }
        [Column("revoked_by_ip")] public string?         RevokedByIp { get; set; }

        [MaxLength(512), Column("replaced_by_token")]
        public string? ReplacedByToken { get; set; }

        [MaxLength(255), Column("device_info")]
        public string? DeviceInfo { get; set; }

        [Column("is_revoked")]
        public bool IsRevoked { get; set; } = false;

        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
