using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("trip_plan_items")]
    public class TripPlanItem
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("trip_plan_id")]
        public Guid TripPlanId { get; set; }

        // destination | place | event | activity
        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!;

        [Column("entity_id")]
        public Guid EntityId { get; set; }

        [Column("planned_at")] public DateTimeOffset? PlannedAt { get; set; }

        [MaxLength(300), Column("note")]
        public string? Note { get; set; }

        [Column("sort_order")] public int  SortOrder { get; set; } = 0;
        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("TripPlanId")]
        public TripPlan TripPlan { get; set; } = null!;
    }
}
