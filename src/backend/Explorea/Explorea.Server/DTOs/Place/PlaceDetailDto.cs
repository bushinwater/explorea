using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Place
{
    public class PlaceDetailDto : PlaceCardDto
    {
        public string? Description { get; set; }
        public string? Phone { get; set; }
        public string? WebsiteUrl { get; set; }
        public LocationDto? Location { get; set; }
        public List<PlaceImageDto> Images { get; set; } = new();
        public List<AmenityDto> Amenities { get; set; } = new();
        public List<WorkingDayDto> WorkingDays { get; set; } = new();
        public List<object> Events { get; set; } = new();
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<PlaceCardDto> SimilarPlaces { get; set; } = new();
    }
}