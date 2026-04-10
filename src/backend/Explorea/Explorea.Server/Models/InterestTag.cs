using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("interest_tags")]
    public class InterestTag
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(100), Column("name")]
        public string Name { get; set; } = null!;

        [MaxLength(100), Column("icon")]
        public string? Icon { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        public ICollection<UserInterestTag>        UserLinks        { get; set; } = new List<UserInterestTag>();
        public ICollection<DestinationInterestTag> DestinationLinks { get; set; } = new List<DestinationInterestTag>();
        public ICollection<PlaceInterestTag>       PlaceLinks       { get; set; } = new List<PlaceInterestTag>();
        public ICollection<EventInterestTag>       EventLinks       { get; set; } = new List<EventInterestTag>();
        public ICollection<ActivityInterestTag>    ActivityLinks    { get; set; } = new List<ActivityInterestTag>();
    }
}
