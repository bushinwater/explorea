using Explorea.API.DTOs.Search;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
  public class SearchPageService : ISearchPageService
  {
    private readonly ISearchPageRepository _searchPageRepository;

    public SearchPageService(ISearchPageRepository searchPageRepository)
    {
      _searchPageRepository = searchPageRepository;      
    }
    
    public async Task<SearchPageAllResponseDto> GetAllAsync(SearchPageAllQueryDto query)
    {
      ValidateAllQuery(query);

      var normalizedQuery = NormalizeAllQuery(query);
      
      var popularDestinations = await _searchPageRepository.GetPopularDestinationsAsync(normalizedQuery, take: 8);
      var topRatedPlaces = await _searchPageRepository.GetTopRatedPlacesAsync(normalizedQuery, take: 8);
      var nearbyEvents = await _searchPageRepository.GetNearbyEventsAsync(normalizedQuery, take: 8);
      var popularActivities = await _searchPageRepository.GetPopularActivitiesAsync(normalizedQuery, take: 8);

      return new SearchPageAllResponseDto
      {
        Tab = "all",
        Summary = new SearchPageSummaryDto
        {
          Query = normalizedQuery.Query,
          TotalMatched = popularDestinations.Count 
                       + topRatedPlaces.Count
                       + nearbyEvents.Count
                       + popularActivities.Count
        },
        Sections = new List<SearchPageSectionDto>
        {
          new SearchPageSectionDto
          {
            Key = "popular_destinations",
            Title = "Popularne destinacije",
            EntityType = "destination",
            Items = WrapItems(popularDestinations, "destination")
          },
          new SearchPageSectionDto
          {
            Key = "top_rated_places",
            Title = "Najbolje ocenjeni objekti",
            EntityType = "place",
            Items = WrapItems(topRatedPlaces, "place")
          },
          new SearchPageSectionDto
          {
            Key = "nearby_events",
            Title = "Događaji",
            EntityType = "event",
            Items = WrapItems(nearbyEvents, "event")
          },
          new SearchPageSectionDto
          {
            Key = "popular_activities",
            Title = "Popularne aktivnosti",
            EntityType = "activity",
            Items = WrapItems(popularActivities, "activity")
          },
        }
      };
    }

    public async Task<SearchPageListResponseDto> GetListAsync(SearchPageListQueryDto query)
    {
      ValidateListQuery(query);

      var normalizedQuery = NormalizeListQuery(query);
      var normalizedTab = NormalizeTab(normalizedQuery.Tab);
      
      return normalizedTab switch
      {
        "destinations" => await GetDestinationsAsync(normalizedQuery),
        "places" => await GetPlacesAsync(normalizedQuery),
        "activities" => await GetActivitiesAsync(normalizedQuery),
        "events" => await GetEventsAsync(normalizedQuery),
        _ => throw new ArgumentException("Unsupported tab value.")
      };
    }
    
    private async Task<SearchPageListResponseDto> GetEventsAsync(SearchPageListQueryDto query)
    {
      var (items, total) = await _searchPageRepository.SearchEventsAsync(query);
      var availableSorts = GetAvaliableSorts("events");

      return new SearchPageListResponseDto
      {
          Tab = "events",
          Summary = new SearchPageSummaryDto
          {
              Query = query.Query,
              TotalMatched = total
          },
          Items = WrapItems(items, "event"),
          Pagination = BuildPagination(query.Page, query.PageSize, total),
          Sort = new SearchPageSortDto
          {
              Selected = query.SortBy,
              Available = availableSorts
          },
          AppliedFilters = MapAppliedFilters(query)
      };
    }

    private async Task<SearchPageListResponseDto> GetActivitiesAsync(SearchPageListQueryDto query)
    {
      var (items, total) = await _searchPageRepository.SearchActivitiesAsync(query);
      var availableSorts = GetAvaliableSorts("activities");

      return new SearchPageListResponseDto
      {
          Tab = "activities",
          Summary = new SearchPageSummaryDto
          {
              Query = query.Query,
              TotalMatched = total
          },
          Items = WrapItems(items, "activity"),
          Pagination = BuildPagination(query.Page, query.PageSize, total),
          Sort = new SearchPageSortDto
          {
              Selected = query.SortBy,
              Available = availableSorts
          },
          AppliedFilters = MapAppliedFilters(query)
      };
    }

    private async Task<SearchPageListResponseDto> GetPlacesAsync(SearchPageListQueryDto query)
    {
      var (items, total) = await _searchPageRepository.SearchPlacesAsync(query);
      var availableSorts = GetAvaliableSorts("places");

      return new SearchPageListResponseDto
      {
        Tab = "places",
        Summary = new SearchPageSummaryDto
        {
          Query = query.Query,
          TotalMatched = total
        },
        Items = WrapItems(items, "place"),
        Pagination = BuildPagination(query.Page, query.PageSize, total),
        Sort = new SearchPageSortDto
        {
          Selected = query.SortBy,
          Available = availableSorts
        },
        AppliedFilters = MapAppliedFilters(query)
      };
    }

    private async Task<SearchPageListResponseDto> GetDestinationsAsync(SearchPageListQueryDto query)
    {
      var (items, total) = await _searchPageRepository.SearchDestinationsAsync(query);
      var availableSorts = GetAvaliableSorts("destinations");

      return new SearchPageListResponseDto
      {
        Tab = "destinations",
        Summary = new SearchPageSummaryDto
        {
          Query = query.Query,
          TotalMatched = total
        },
        Items = WrapItems(items, "destination"),
        Pagination = BuildPagination(query.Page, query.PageSize, total),
        Sort = new SearchPageSortDto
        {
          Selected = query.SortBy,
          Available = availableSorts
        },
        AppliedFilters = MapAppliedFilters(query)
      };
    }

    private static string? NormalizeString(string? value)
    {
      return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static List<int>? NormalizeIntList(List<int>? values)
    {
      if (values == null || values.Count == 0) return null;

      return values
        .Distinct()
        .OrderBy(x => x)
        .ToList();
    }

    private static List<Guid>? NormalizeGuidList(List<Guid>? values)
    {
      if (values == null || values.Count == 0) return null;

      return values
        .Distinct()
        .OrderBy(x => x)
        .ToList();
    }
    
    private static string NormalizeTab(string tab)
    {
      var value = tab?.Trim().ToLowerInvariant();
      return value switch
      {
        "destination" or "destinations" => "destinations",
        "place" or "places" => "places",
        "activity" or "activities" => "activities",
        "event" or "events" => "events",
        "all" => "all",
        _ => throw new ArgumentException("Unsupported tab value.")
      };
    }

    private static string NormalizeSort(
      string? SortBy,
      string normalizedTab,
      List<string> availableSorts,
      double? userLat,
      double? userLng
    )
    {
      var normalizedSort = NormalizeString(SortBy)?.ToLowerInvariant();

      if (string.IsNullOrWhiteSpace(normalizedSort))
      {
        return GetDefaultSort(normalizedTab);
      }

      if (!availableSorts.Contains(normalizedSort))
      {
        return GetDefaultSort(normalizedTab);
      }

      if(normalizedSort == "nearest" && (!userLat.HasValue || !userLng.HasValue))
      {
        return GetDefaultSort(normalizedTab);
      }

      return normalizedSort;
    }

    private static SearchPageAllQueryDto NormalizeAllQuery(SearchPageAllQueryDto query)
    {
      return new SearchPageAllQueryDto
      {
        Query = NormalizeString(query.Query),
        RegionsIds = NormalizeIntList(query.RegionsIds),
        CityIds = NormalizeIntList(query.CityIds),
        MinRating = query.MinRating,
        UserLat = query.UserLat,
        UserLng = query.UserLng,
        RadiusKm = query.RadiusKm
      };
    }

    private static SearchPageListQueryDto NormalizeListQuery(SearchPageListQueryDto query){
      var normalizedTab = NormalizeTab(query.Tab);
      var availableSorts = GetAvaliableSorts(normalizedTab);

      var normalizedSort = NormalizeSort(query.SortBy, normalizedTab, availableSorts, query.UserLat, query.UserLng);

      return new SearchPageListQueryDto
      {
        Tab = normalizedTab,
        Query = NormalizeString(query.Query),

        RegionsIds = NormalizeIntList(query.RegionsIds),
        CityIds = NormalizeIntList(query.CityIds),
        DestinationsIds = NormalizeGuidList(query.DestinationsIds),

        MinRating = query.MinRating,
        MinPrice = query.MinPrice,
        MaxPrice = query.MaxPrice,

        OpenNow = query.OpenNow,

        PlaceTypeIds = NormalizeIntList(query.PlaceTypeIds),
        ActivityCategoryIds = NormalizeIntList(query.ActivityCategoryIds),
        EventTypeIds = NormalizeIntList(query.EventTypeIds),
        DestinationTypeIds = NormalizeIntList(query.DestinationTypeIds),
        ExtraFilters = query.ExtraFilters,

        SortBy = normalizedSort,

        Page = query.Page,
        PageSize = query.PageSize,

        UserLat = query.UserLat,
        UserLng = query.UserLng,
        RadiusKm = query.RadiusKm
      };
    }

    private static List<string> GetAvaliableSorts(string tab)
    {
      return tab switch
      {
        "destinations" => new List<string> {"popularity", "rating", "nearest", "alphabetical"},
        "places"       => new List<string> {"popularity", "rating", "nearest", "price_asc", "price_desc"},
        "activities"   => new List<string> {"popularity", "rating", "nearest", "duration_asc", "duration_desc", "price_asc", "price_desc"},
        "events"       => new List<string> {"soonest", "popularity", "nearest", "price_asc", "price_desc"},
        _              => new List<string>()
      };
    }

    private static string GetDefaultSort(string tab)
    {
      return tab switch
      {
        "destinations" => "popularity",
        "places"       => "popularity",
        "activities"   => "popularity",
        "events"       => "soonest",
        _              => "popularity"
      };
    }

    private static void ValidateAllQuery(SearchPageAllQueryDto query)
    {
      if(query.UserLat.HasValue ^ query.UserLng.HasValue)
      {
        throw new ArgumentException("UserLat and UserLng must be provided together.");        
      }

      if(query.UserLat is < -90 or > 90)
      {
        throw new ArgumentException("UserLat must be between -90 and 90.");        
      }

      if(query.UserLng is < -180 or > 180)
      {
        throw new ArgumentException("UserLng must be between -180 and 180.");        
      }

      if(query.MinRating is < 0 or > 5)
      {
        throw new ArgumentException("MinRating must be between 0 and 5.");        
      }
    }

    private static void ValidateListQuery(SearchPageListQueryDto query)
    {
      if (string.IsNullOrWhiteSpace(query.Tab))
      {
        throw new ArgumentException("Tab is required.");
      }
      
      if (query.Page < 1)
      {
        throw new ArgumentException("Page must be greater than or equal to 1.");
      }
      
      if (query.PageSize < 1 || query.PageSize > 50)
      {
        throw new ArgumentException("PageSize must be between 1 and 50.");
      }
      
      if(query.UserLat.HasValue ^ query.UserLng.HasValue)
      {
        throw new ArgumentException("UserLat and UserLng must be provided together.");        
      }

      if(query.UserLat is < -90 or > 90)
      {
        throw new ArgumentException("UserLat must be between -90 and 90.");        
      }

      if(query.UserLng is < -180 or > 180)
      {
        throw new ArgumentException("UserLng must be between -180 and 180.");        
      }

      if(query.MinRating is < 0 or > 5)
      {
        throw new ArgumentException("MinRating must be between 0 and 5.");        
      }

      if(query.MinPrice.HasValue && query.MinPrice < 0)
      {
        throw new ArgumentException("MinPrice must be greater than or equal to 0.");        
      }
      
      if(query.MaxPrice.HasValue && query.MaxPrice < 0)
      {
        throw new ArgumentException("MaxPrice must be greater than or equal to 0.");        
      }
      
      if(query.MinPrice.HasValue && query.MaxPrice.HasValue && query.MinPrice > query.MaxPrice)
      {
        throw new ArgumentException("MinPrice cannot be greater than MaxPrice.");        
      }
    }
    
    private SearchPagePaginationDto BuildPagination(int page, int pageSize, int total)
    {
      var totalPages = (int)Math.Ceiling(total / (double)pageSize);

      return new SearchPagePaginationDto
      {
        Page = page,
        PageSize = pageSize,
        Total = total,
        TotalPages = totalPages
      };
    }

    private static List<SearchItemDto> WrapItems<T>(IEnumerable<T> items, string entityType)
    {
      return items 
       .Select(item => new SearchItemDto
       {
         EntityType = entityType,
         Entity = item!
       })
       .ToList();
    }

    private SearchPageAppliedFilterDto MapAppliedFilters(SearchPageListQueryDto query)
    {
      return new SearchPageAppliedFilterDto
      {
        RegionsIds = query.RegionsIds,
        CityIds = query.CityIds,
        DestinationIds = query.DestinationsIds,
        MinRating = query.MinRating,
        MinPrice = query.MinPrice,
        MaxPrice = query.MaxPrice,
        OpenNow = query.OpenNow,
        PlaceTypeIds = query.PlaceTypeIds,
        ActivityCategoryIds = query.ActivityCategoryIds,
        EventTypeIds = query.EventTypeIds
      };
    }
  }
}