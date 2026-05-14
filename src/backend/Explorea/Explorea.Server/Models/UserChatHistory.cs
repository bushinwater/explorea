using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("user_chat_histories")]
    public class UserChatHistory
    {
        [Key]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("messages", TypeName = "jsonb")]
        public string Messages { get; set; } = "[]";

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
