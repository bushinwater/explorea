using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Destination
{
    public class DestinationDetailDto : DestinationCardDto
    {
        public string? Description { get; set; }
        public List<DestinationImageDto> Images { get; set; } = new();
        public List<PlaceCardDto> Places { get; set; } = new();
        public List<EventCardDto> Events { get; set; } = new();
        public List<ActivityCardDto> Activities { get; set; } = new();
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<DestinationCardDto> SimilarDestinations { get; set; } = new();
    }
}