using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("user_preferences")]
    public class UserPreferences
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(20), Column("theme")]
        public string Theme { get; set; } = "system";

        [Required, MaxLength(10), Column("language")]
        public string Language { get; set; } = "sr";

        [Column("notifications_enabled")]
        public bool NotificationsEnabled { get; set; } = true;

        [Required, MaxLength(80), Column("default_admin_page")]
        public string DefaultAdminPage { get; set; } = "dashboard";

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
