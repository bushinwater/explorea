using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Review;

namespace Explorea.API.DTOs.Home
{ 
  public class HomeDataDto
  {
    public List<HeroBannerDto> HeroBanners {get; set;} = new();
    public List<DestinationCardDto> FeaturedDestinations {get; set;} = new();
    public List<EventCardDto> UpcomingEvents {get; set;} = new();
    public List<ActivityCardDto> PopularActivities {get; set;} = new();
    public List<ReviewDto> TravelerReviews {get; set;} = new();
  }
}