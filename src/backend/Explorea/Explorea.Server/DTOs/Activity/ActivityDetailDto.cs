using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Activity
{
    public class ActivityDetailDto : ActivityCardDto
    {
        public string? Description { get; set; }
        public SeasonRefDto? Season { get; set; }
        public decimal? DistanceKm { get; set; }
        public string? StartPoint { get; set; }
        public object? ExtraData { get; set; }
        public LocationDto? Location { get; set; }
        public List<InclusionDto> Inclusions { get; set; } = new();
        public List<ActivityImageDto> Images { get; set; } = new();
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<ActivityCardDto> SimilarActivities { get; set; } = new();
    }
}