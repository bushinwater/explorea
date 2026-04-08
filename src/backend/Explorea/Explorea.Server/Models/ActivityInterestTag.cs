using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("activity_interest_tags")]
    public class ActivityInterestTag
    {
        [Column("activity_id")]
        public Guid ActivityId { get; set; }

        [Column("interest_tag_id")]
        public int InterestTagId { get; set; }

        public Activity Activity { get; set; } = null!;
        public InterestTag InterestTag { get; set; } = null!;
    }
}
