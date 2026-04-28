using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("organization_region_assignments")]
    public class OrganizationRegionAssignment
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("organization_user_id")]
        public Guid OrganizationUserId { get; set; }

        [Column("region_id")]
        public int RegionId { get; set; }

        [Column("assigned_at")]
        public DateTimeOffset AssignedAt { get; set; }

        [Column("assigned_by")]
        public Guid AssignedBy { get; set; }

        [ForeignKey("OrganizationUserId")]
        public User OrganizationUser { get; set; } = null!;

        [ForeignKey("RegionId")]
        public Region Region { get; set; } = null!;

        [ForeignKey("AssignedBy")]
        public User AssignedByUser { get; set; } = null!;
    }
}
