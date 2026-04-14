using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("organization_assignments")]
    public class OrganizationAssignment
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("organization_user_id")]
        public Guid OrganizationUserId { get; set; }

        [Column("destination_id")]
        public Guid DestinationId { get; set; }

        [Column("assigned_at")]
        public DateTimeOffset AssignedAt { get; set; }

        [Column("assigned_by")]
        public Guid AssignedBy { get; set; }

        [ForeignKey("OrganizationUserId")]
        public User OrganizationUser { get; set; } = null!;

        [ForeignKey("DestinationId")]
        public Destination Destination { get; set; } = null!;

        [ForeignKey("AssignedBy")]
        public User AssignedByUser { get; set; } = null!;
    }
}
