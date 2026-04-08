using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("destination_interest_tags")]
    public class DestinationInterestTag
    {
        [Column("destination_id")]
        public Guid DestinationId { get; set; }

        [Column("interest_tag_id")]
        public int InterestTagId { get; set; }

        public Destination Destination { get; set; } = null!;
        public InterestTag InterestTag { get; set; } = null!;
    }
}
