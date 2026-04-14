using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("event_interest_tags")]
    public class EventInterestTag
    {
        [Column("event_id")]
        public Guid EventId { get; set; }

        [Column("interest_tag_id")]
        public int InterestTagId { get; set; }

        public Event Event { get; set; } = null!;
        public InterestTag InterestTag { get; set; } = null!;
    }
}
