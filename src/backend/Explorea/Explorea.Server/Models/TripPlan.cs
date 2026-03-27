using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("trip_plans")]
    public class TripPlan
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Column("start_at")] public DateTimeOffset? StartAt { get; set; }
        [Column("end_at")]   public DateTimeOffset? EndAt   { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public ICollection<TripPlanItem> Items { get; set; } = new List<TripPlanItem>();
    }
}
