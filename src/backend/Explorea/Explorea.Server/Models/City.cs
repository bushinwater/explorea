using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("cities")]
    public class City
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Column("region_id")]
        public int? RegionId { get; set; }

        [Required, MaxLength(100), Column("name")]
        public string Name { get; set; } = null!;

        [Column("latitude")]  public double Latitude  { get; set; }
        [Column("longitude")] public double Longitude { get; set; }

        [Column("location", TypeName = "geography(Point, 4326)")]
        public Point Location { get; set; } = null!;

        [MaxLength(500), Column("cover_image_url")]
        public string? CoverImageUrl { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("RegionId")]
        public Region? Region { get; set; }

        public ICollection<Destination> Destinations { get; set; } = new List<Destination>();
        public ICollection<Place>       Places        { get; set; } = new List<Place>();
        public ICollection<Event>       Events        { get; set; } = new List<Event>();
        public ICollection<Activity>    Activities    { get; set; } = new List<Activity>();
    }
}
