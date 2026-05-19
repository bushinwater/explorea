using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("places")]
    public class Place
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("city_id")]        public int?  CityId        { get; set; }
        [Column("destination_id")] public Guid? DestinationId { get; set; }
        [Column("type_id")]        public int?  TypeId        { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Required, MaxLength(220), Column("slug")]
        public string Slug { get; set; } = null!;

        [Column("description")] public string? Description { get; set; }

        [MaxLength(300), Column("address")]    public string? Address   { get; set; }
        [Column("latitude")]                   public double?  Latitude  { get; set; }
        [Column("longitude")]                  public double?  Longitude { get; set; }

        [Column("location", TypeName = "geography(Point, 4326)")]
        public Point Location { get; set; } = null!;

        // The places table has no preview_image_url column — images live in place_images.
        [NotMapped]
        public string? PreviewImageUrl { get; set; }

        [MaxLength(50),  Column("price_range")]  public string?  PriceRange    { get; set; }
        [Column("price_per_night")]               public decimal? PricePerNight { get; set; }
        [MaxLength(50),  Column("phone")]        public string? Phone      { get; set; }
        [MaxLength(500), Column("website_url")]  public string? WebsiteUrl { get; set; }

        [Column("country_id")] public int? CountryId { get; set; }
        [Column("popularity")] public int Popularity { get; set; } = 0;

        [Column("avg_rating")]  public decimal AvgRating  { get; set; } = 0;
        [Column("is_featured")] public bool    IsFeatured { get; set; } = false;

        [Column("extra_filters", TypeName = "jsonb")]
        public string? ExtraFilters { get; set; }

        [MaxLength(20), Column("approval_status")]
        public string ApprovalStatus { get; set; } = "approved";

        [Column("is_deleted")]  public bool    IsDeleted  { get; set; } = false;
        [Column("deleted_at")]  public DateTimeOffset? DeletedAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("CityId")]        public City?        City        { get; set; }
        [ForeignKey("DestinationId")] public Destination? Destination { get; set; }
        [ForeignKey("TypeId")]        public PlaceType?   Type        { get; set; }
        [ForeignKey("CountryId")]     public Country?     Country     { get; set; }


        public ICollection<PlaceImage>        Images      { get; set; } = new List<PlaceImage>();
        public ICollection<PlaceAmenityLink>  AmenityLinks{ get; set; } = new List<PlaceAmenityLink>();
        public ICollection<PlaceWorkingDay>   WorkingDays { get; set; } = new List<PlaceWorkingDay>();
        public ICollection<Event>             Events      { get; set; } = new List<Event>();
        public ICollection<Activity>          Activities  { get; set; } = new List<Activity>();
    }
}
