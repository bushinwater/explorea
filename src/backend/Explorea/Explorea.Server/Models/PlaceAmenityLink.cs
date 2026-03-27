using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("place_amenity_links")]
    public class PlaceAmenityLink
    {
        [Column("place_id")]   public Guid PlaceId   { get; set; }
        [Column("amenity_id")] public int  AmenityId { get; set; }

        [ForeignKey("PlaceId")]   public Place        Place   { get; set; } = null!;
        [ForeignKey("AmenityId")] public PlaceAmenity Amenity { get; set; } = null!;
    }
}
