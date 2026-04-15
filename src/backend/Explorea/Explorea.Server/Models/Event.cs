using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("events")]
    public class Event
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Column("city_id")]        public int?  CityId        { get; set; }
        [Column("destination_id")] public Guid? DestinationId { get; set; }
        [Column("place_id")]       public Guid? PlaceId       { get; set; }
        [Column("type_id")]        public int   TypeId        { get; set; }

        [Required, MaxLength(200), Column("name")]
        public string Name { get; set; } = null!;

        [Required, MaxLength(220), Column("slug")]
        public string Slug { get; set; } = null!;

        [Column("start_datetime")] public DateTimeOffset StartDatetime { get; set; }
        [Column("end_datetime")]   public DateTimeOffset EndDatetime   { get; set; }

        [Column("price")]   public decimal? Price   { get; set; }

        [MaxLength(300), Column("address")]
        public string? Address { get; set; }

        [Column("latitude")]  public double? Latitude  { get; set; }
        [Column("longitude")] public double? Longitude { get; set; }

        [Column("location", TypeName = "geography(Point, 4326)")]
        public Point? Location { get; set; }

        [Column("description")] public string? Description { get; set; }

        [MaxLength(500), Column("ticket_url")]
        public string? TicketUrl { get; set; }

        [Column("country_id")] public int? CountryId { get; set; }
        [Column("popularity")] public int Popularity { get; set; } = 0;

        [Column("is_featured")] public bool IsFeatured { get; set; } = false;
        [Column("is_deleted")]  public bool IsDeleted  { get; set; } = false;
        [Column("deleted_at")]  public DateTimeOffset? DeletedAt { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("CityId")]        public City?        City        { get; set; }
        [ForeignKey("DestinationId")] public Destination? Destination { get; set; }
        [ForeignKey("PlaceId")]       public Place?       Place       { get; set; }
        [ForeignKey("TypeId")]        public EventType    Type        { get; set; } = null!;
        [ForeignKey("CountryId")]     public Country?     Country     { get; set; }

        public ICollection<EventImage> Images { get; set; } = new List<EventImage>();
        public ICollection<EventInterestTag> InterestTags { get; set; } = new List<EventInterestTag>();

        [MaxLength(500), Column("preview_image_url")]
        public string? PreviewImageUrl { get; set; }
        [Column("avg_rating")]  public decimal AvgRating  { get; set; } = 0;
  }
}
