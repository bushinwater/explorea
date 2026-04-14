using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("submission_queue")]
    public class SubmissionQueue
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!; // "place" | "activity" | "event"

        [Column("entity_id")]
        public Guid EntityId { get; set; }

        [Column("destination_id")]
        public Guid DestinationId { get; set; }

        [Column("linked_place_id")]
        public Guid? LinkedPlaceId { get; set; }

        [Required, MaxLength(30), Column("status")]
        public string Status { get; set; } = "Pending";
        // Pending | ApprovedByTO | RejectedByTO | ApprovedByOwner | RejectedByOwner

        [Column("submitted_by_user_id")]
        public Guid SubmittedByUserId { get; set; }

        [Column("submitted_at")]
        public DateTimeOffset SubmittedAt { get; set; }

        [Column("reviewed_by_to_user_id")]
        public Guid? ReviewedByTOUserId { get; set; }

        [Column("reviewed_by_to_at")]
        public DateTimeOffset? ReviewedByTOAt { get; set; }

        [Column("reviewed_by_owner_id")]
        public Guid? ReviewedByOwnerId { get; set; }

        [Column("reviewed_by_owner_at")]
        public DateTimeOffset? ReviewedByOwnerAt { get; set; }

        [MaxLength(1000), Column("rejection_reason")]
        public string? RejectionReason { get; set; }

        [ForeignKey("DestinationId")]
        public Destination Destination { get; set; } = null!;

        [ForeignKey("SubmittedByUserId")]
        public User SubmittedByUser { get; set; } = null!;

        [ForeignKey("ReviewedByTOUserId")]
        public User? ReviewedByTOUser { get; set; }

        [ForeignKey("ReviewedByOwnerId")]
        public User? ReviewedByOwner { get; set; }
    }
}
