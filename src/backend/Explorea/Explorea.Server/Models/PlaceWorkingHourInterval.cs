using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("place_working_hour_intervals")]
    public class PlaceWorkingHourInterval
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("working_day_id")]
        public Guid WorkingDayId { get; set; }

        [Column("opens_at")]  public TimeOnly OpensAt  { get; set; }
        [Column("closes_at")] public TimeOnly ClosesAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("WorkingDayId")]
        public PlaceWorkingDay WorkingDay { get; set; } = null!;
    }
}
