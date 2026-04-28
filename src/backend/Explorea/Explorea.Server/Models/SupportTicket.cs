using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("support_tickets")]
    public class SupportTicket
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Required, MaxLength(200), Column("title")]
        public string Title { get; set; } = null!;

        [Required, MaxLength(30), Column("status")]
        public string Status { get; set; } = SupportTicketStatuses.Open;

        [Required, MaxLength(20), Column("priority")]
        public string Priority { get; set; } = SupportTicketPriorities.Medium;

        [Column("owner_user_id")]
        public Guid? OwnerUserId { get; set; }

        [Column("assigned_to_user_id")]
        public Guid? AssignedToUserId { get; set; }

        [Column("created_by_admin_id")]
        public Guid? CreatedByAdminId { get; set; }

        [MaxLength(30), Column("linked_context_type")]
        public string? LinkedContextType { get; set; }

        [Column("linked_context_id")]
        public Guid? LinkedContextId { get; set; }

        [Column("is_escalated")]
        public bool IsEscalated { get; set; } = false;

        [Column("escalated_at")]
        public DateTimeOffset? EscalatedAt { get; set; }

        [Column("escalated_by_user_id")]
        public Guid? EscalatedByUserId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("last_activity_at")]
        public DateTimeOffset LastActivityAt { get; set; }

        [Column("resolved_at")]
        public DateTimeOffset? ResolvedAt { get; set; }

        [Column("closed_at")]
        public DateTimeOffset? ClosedAt { get; set; }

        [ForeignKey("OwnerUserId")]
        public User? OwnerUser { get; set; }

        [ForeignKey("AssignedToUserId")]
        public User? AssignedToUser { get; set; }

        [ForeignKey("CreatedByAdminId")]
        public User? CreatedByAdmin { get; set; }

        [ForeignKey("EscalatedByUserId")]
        public User? EscalatedByUser { get; set; }

        public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
    }
}
