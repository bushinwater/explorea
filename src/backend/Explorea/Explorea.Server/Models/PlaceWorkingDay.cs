using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("place_working_days")]
    public class PlaceWorkingDay
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("place_id")]
        public Guid PlaceId { get; set; }

        [Column("day_of_week")] public short DayOfWeek { get; set; }
        [Column("is_closed")]   public bool  IsClosed  { get; set; } = false;

        [MaxLength(200), Column("note")]
        public string? Note { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("PlaceId")]
        public Place Place { get; set; } = null!;

        public ICollection<PlaceWorkingHourInterval> Intervals { get; set; } = new List<PlaceWorkingHourInterval>();
    }
}
