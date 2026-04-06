using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;

namespace Explorea.API.DTOs.Home
{
  public class RecommendationsDto
  {
    public List<DestinationCardDto> Destinations {get; set;} = new();
    public List<EventCardDto> Events {get; set;} = new();
    public List<ActivityCardDto> Activities {get; set;} = new();
  }
}