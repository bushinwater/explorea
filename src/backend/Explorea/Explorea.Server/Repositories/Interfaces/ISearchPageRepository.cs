using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Search;

namespace Explorea.Server.Repositories.Interfaces
{
  public interface ISearchPageRepository
  {
    Task<List<DestinationCardDto>> GetPopularDestinationsAsync(SearchPageAllQueryDto query, int take);
    Task<List<PlaceCardDto>> GetTopRatedPlacesAsync(SearchPageAllQueryDto query, int take);
    Task<List<EventCardDto>> GetNearbyEventsAsync(SearchPageAllQueryDto query, int take);
    Task<List<ActivityCardDto>> GetPopularActivitiesAsync(SearchPageAllQueryDto query, int take);

    Task<(List<DestinationCardDto> Items, int Total)> SearchDestinationsAsync(SearchPageListQueryDto query);
    Task<(List<PlaceCardDto> Items, int Total)> SearchPlacesAsync(SearchPageListQueryDto query);
    Task<(List<EventCardDto> Items, int Total)> SearchEventsAsync(SearchPageListQueryDto query);
    Task<(List<ActivityCardDto> Items, int Total)> SearchActivitiesAsync(SearchPageListQueryDto query);
  }
}