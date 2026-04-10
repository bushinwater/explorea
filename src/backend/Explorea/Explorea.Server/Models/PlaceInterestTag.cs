using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("place_interest_tags")]
    public class PlaceInterestTag
    {
        [Column("place_id")]
        public Guid PlaceId { get; set; }

        [Column("interest_tag_id")]
        public int InterestTagId { get; set; }

        public Place Place { get; set; } = null!;
        public InterestTag InterestTag { get; set; } = null!;
    }
}
