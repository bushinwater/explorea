using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("report_templates")]
    public class ReportTemplate
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Column("parameters", TypeName = "jsonb")]
        public string Parameters { get; set; } = "{}";

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}
