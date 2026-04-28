using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("support_messages")]
    public class SupportMessage
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("ticket_id")]
        public Guid TicketId { get; set; }

        [Column("sender_user_id")]
        public Guid SenderUserId { get; set; }

        [Required, MaxLength(30), Column("sender_type")]
        public string SenderType { get; set; } = SupportSenderTypes.User;

        [Required, Column("content")]
        public string Content { get; set; } = null!;

        [Column("is_internal")]
        public bool IsInternal { get; set; } = false;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [ForeignKey("TicketId")]
        public SupportTicket Ticket { get; set; } = null!;

        [ForeignKey("SenderUserId")]
        public User SenderUser { get; set; } = null!;
    }
}
