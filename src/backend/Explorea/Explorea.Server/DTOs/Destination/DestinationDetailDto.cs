using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Destination
{
    public class DestinationDetailDto : DestinationCardDto
    {
        public string? Description { get; set; }
        public List<DestinationImageDto> Images { get; set; } = new();
        public List<object> Places { get; set; } = new();
        public List<object> Events { get; set; } = new();
        public List<object> Activities { get; set; } = new();
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<DestinationCardDto> SimilarDestinations { get; set; } = new();
    }
}