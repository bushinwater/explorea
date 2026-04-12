using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("activities")]
    public class Activity
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("city_id")]        public int?  CityId        { get; set; }
        [Column("destination_id")] public Guid? DestinationId { get; set; }
        [Column("place_id")]       public Guid? PlaceId       { get; set; }
        [Column("category_id")]    public int   CategoryId    { get; set; }
        [Column("season_id")]      public int?  SeasonId      { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Required, MaxLength(220), Column("slug")]
        public string Slug { get; set; } = null!;

        [Column("description")] public string? Description { get; set; }

        [Column("price")]            public decimal? Price           { get; set; }
        [Column("duration_minutes")] public int?     DurationMinutes { get; set; }

        [MaxLength(50), Column("difficulty_level")]
        public string? DifficultyLevel { get; set; }

        [Column("distance_km")] public decimal? DistanceKm { get; set; }

        [MaxLength(200), Column("start_point")]
        public string? StartPoint { get; set; }

        [Column("avg_rating")] public decimal AvgRating { get; set; } = 0;

        // JSONB — čuva specifične podatke po kategoriji (uspon, tip staze itd.)
        [Column("extra_data", TypeName = "jsonb")]
        public string? ExtraData { get; set; }

        [Column("latitude")]  public double? Latitude  { get; set; }
        [Column("longitude")] public double? Longitude { get; set; }

        [Column("location", TypeName = "geography(Point, 4326)")]
        public Point? Location { get; set; }

        [Column("country_id")] public int? CountryId { get; set; }
        [Column("popularity")] public int Popularity { get; set; } = 0;

        [MaxLength(500), Column("organizer_website")]
        public string? OrganizerWebsite { get; set; }

        [Column("is_featured")] public bool IsFeatured { get; set; } = false;
        [Column("is_deleted")]  public bool IsDeleted  { get; set; } = false;
        [Column("deleted_at")]  public DateTimeOffset? DeletedAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("CityId")]        public City?             City        { get; set; }
        [ForeignKey("DestinationId")] public Destination?      Destination { get; set; }
        [ForeignKey("PlaceId")]       public Place?            Place       { get; set; }
        [ForeignKey("CategoryId")]    public ActivityCategory  Category    { get; set; } = null!;
        [ForeignKey("SeasonId")]      public Season?           Season      { get; set; }
        [ForeignKey("CountryId")]     public Country?          Country     { get; set; }

        public ICollection<ActivityInclusion>  Inclusions   { get; set; } = new List<ActivityInclusion>();
        public ICollection<ActivityImage>      Images       { get; set; } = new List<ActivityImage>();
        public ICollection<ActivityInterestTag> InterestTags { get; set; } = new List<ActivityInterestTag>();
    }
}
