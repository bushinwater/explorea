using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Event
{
    public class EventDetailDto : EventCardDto
    {
        public string? Description { get; set; }
        public string? LocationName { get; set; }
        public string? TicketUrl { get; set; }
        public LocationDto? Location { get; set; }
        public List<EventImageDto> Images { get; set; } = new();
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<EventCardDto> SimilarEvents { get; set; } = new();
    }
}