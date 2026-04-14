using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("destinations")]
    public class Destination
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("city_id")]
        public int? CityId { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Required, MaxLength(220), Column("slug")]
        public string Slug { get; set; } = null!;

        [Column("description")]
        public string? Description { get; set; }

        [Column("latitude")]  public double Latitude  { get; set; }
        [Column("longitude")] public double Longitude { get; set; }

        [Column("location", TypeName = "geography(Point, 4326)")]
        public Point Location { get; set; } = null!;

        [MaxLength(500), Column("preview_image_url")]
        public string? PreviewImageUrl { get; set; }

        [Column("avg_rating")]  public decimal AvgRating  { get; set; } = 0;
        [Column("is_featured")] public bool    IsFeatured { get; set; } = false;
        [Column("is_deleted")]  public bool    IsDeleted  { get; set; } = false;
        [Column("deleted_at")]  public DateTimeOffset? DeletedAt { get; set; }

        [Column("country_id")] public int? CountryId { get; set; }
        [MaxLength(500), Column("hero_image_url")] 
        public string? HeroImageUrl { get; set; }

        [Column("popularity")] public int Popularity { get; set; } = 0;

        [MaxLength(20), Column("visibility")]
        public string Visibility { get; set; } = "published";

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("CityId")]
        public City? City { get; set; }

        [ForeignKey("CountryId")]
        public Country? Country { get; set; }

        public ICollection<DestinationImage> Images     { get; set; } = new List<DestinationImage>();
        public ICollection<Place>            Places     { get; set; } = new List<Place>();
        public ICollection<Event>            Events     { get; set; } = new List<Event>();
        public ICollection<Activity>         Activities { get; set; } = new List<Activity>();
    }
}
