using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("user_interest_tags")]
    public class UserInterestTag
    {
        [Column("user_id")]         public Guid UserId        { get; set; }
        [Column("interest_tag_id")] public int  InterestTagId { get; set; }

        [ForeignKey("UserId")]        public User        User        { get; set; } = null!;
        [ForeignKey("InterestTagId")] public InterestTag InterestTag { get; set; } = null!;
    }
}
