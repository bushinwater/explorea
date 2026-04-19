using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Search;
using Explorea.API.Models;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Explorea.Server.Models;

namespace Explorea.Server.Services
{
  public class SearchService : ISearchService
  {
    private readonly ISearchRepository _searchRepository;

    public SearchService(ISearchRepository searchRepository)
    {
      _searchRepository = searchRepository;
    }

    public async Task<SearchResultDto> SearchAsync(string? query, int limit = 10)
    {
      if(string.IsNullOrWhiteSpace(query)) return Empty();

      query = NormalizeQuery(query);

      if(query.Length < 2) return Empty();

      limit = Math.Clamp(limit, 1, 10);

      switch (query)
      {
        case "aktivnost":
        case "aktivnosti":
        case "activity":
        case "activities":
          return await SearchAllActivitiesAsync(limit);

        case "destinacije":
        case "destinacija":
        case "destination":
        case "destinations":
          return await SearchAllDestinationsAsync(limit);

        case "mesta":
        case "mesto":
        case "place":
        case "places":
          return await SearchAllPlacesAsync(limit);

        case "dogadjaji":
        case "dogadjaj":
        case "event":
        case "events":
          return await SearchAllEventsAsync(limit);
      }
      
      var now = DateTimeOffset.UtcNow;

      var destinations = await _searchRepository.SearchDestinationsAsync(query);
      var places = await _searchRepository.SearchPlacesAsync(query);
      var events = await _searchRepository.SearchEventsAsync(query, now);
      var activities = await _searchRepository.SearchActivitiesAsync(query);

      // await Task.WhenAll(destinationsTask, placesTask, eventsTask, activitiesTask);

      var candidates = new List<SearchCandidate>();

      foreach(var destinationHit in destinations)
      {
        var destination = destinationHit.Entity;

        candidates.Add(new SearchCandidate
        {
          EntityType = "destination",
          Entity = destination,
          Score = ScoreDestination(destination, query) + ScoreDestinationHybrid(destinationHit, query),
          IsFeatured = destination.IsFeatured,
          AvgRating = destination.AvgRating,
          EventStartDatetime = null,
          Name = destination.Name
        });
      }

      foreach (var placeHit in places)
      {
        var place = placeHit.Entity;
        candidates.Add(new SearchCandidate
        {
          EntityType = "place",
          Entity = place,
          Score = ScorePlace(place, query) + ScorePlaceHybrid(placeHit, query),
          IsFeatured = place.IsFeatured,
          AvgRating = place.AvgRating,
          EventStartDatetime = null,
          Name = place.Name
        });
      }
      
      foreach (var evHit in events)
      {
        var ev = evHit.Entity;
        candidates.Add(new SearchCandidate
        {
          EntityType = "event",
          Entity = ev,
          Score = ScoreEvent(ev, query) + ScoreEventHybrid(evHit, query),
          IsFeatured = ev.IsFeatured,
          AvgRating = null,
          EventStartDatetime = ev.StartDatetime,
          Name = ev.Name
        });
      }

      foreach (var activityHit in activities)
      {
        var activity = activityHit.Entity;
        candidates.Add(new SearchCandidate
        {
          EntityType = "activity",
          Entity = activity,
          Score = ScoreActivity(activity, query) + ScoreActivityHybrid(activityHit, query),
          IsFeatured = activity.IsFeatured,
          AvgRating = activity.AvgRating,
          EventStartDatetime = null,
          Name = activity.Name
        });
      }

      var rankedCandidates = candidates
        .Where(c => c.Score > 0)
        .OrderByDescending(c => c.Score)
        .ThenByDescending(c => c.IsFeatured)
        .ThenByDescending(c => c.AvgRating ?? 0m)
        .ThenBy(c => c.EventStartDatetime ?? DateTimeOffset.MaxValue)
        .ThenBy(c => c.Name)
        .ToList();

      var finalItems = rankedCandidates
        .Take(limit)
        .Select(MapCandidateToSearchItem)
        .ToList();

      return new SearchResultDto
      {
        Total = rankedCandidates.Count,
        Results = finalItems
      };
    }

    private static SearchResultDto Empty()
    {
      return new SearchResultDto
      {
        Total = 0,
        Results = new List<SearchItemDto>()
      };
    }

    // SEARCH HELPERI
    private async Task<SearchResultDto> SearchAllActivitiesAsync(int limit)
    {
      var activities = await _searchRepository.GetActivitiesForSearchAsync(limit);

      return new SearchResultDto
      {
        Total = activities.Count,
        Results = activities.Select(a => new SearchItemDto
        {
          EntityType = "activity",
          Entity = MapActivityToSearchItem(a)
        }).ToList()
      };
    }
    private async Task<SearchResultDto> SearchAllDestinationsAsync(int limit)
    {
      var destinations = await _searchRepository.GetDestinationsForSearchAsync(limit);

      return new SearchResultDto
      {
        Total = destinations.Count,
        Results = destinations.Select(d => new SearchItemDto
        {
          EntityType = "destination",
          Entity = MapDestinationToSearchItem(d)
        }).ToList()
      };
    }
    private async Task<SearchResultDto> SearchAllPlacesAsync(int limit)
    {
      var places = await _searchRepository.GetPlacesForSearchAsync(limit);

      return new SearchResultDto
      {
        Total = places.Count,
        Results = places.Select(p => new SearchItemDto
        {
          EntityType = "place",
          Entity = MapPlaceToSearchItem(p)
        }).ToList()
      };
    }
    private async Task<SearchResultDto> SearchAllEventsAsync(int limit)
    {
      var events = await _searchRepository.GetEventsForSearchAsync(DateTimeOffset.UtcNow, limit);

      return new SearchResultDto
      {
        Total = events.Count,
        Results = events.Select(e => new SearchItemDto
        {
          EntityType = "event",
          Entity = MapEventToSearchItem(e)
        }).ToList()
      };
    
    }

    // SCORING METODE
    private int ScoreDestination(Destination destination, string query)
    {
      var score = 0;

      score += ScoreName(destination.Name, query);
      score += ScoreRelatedField(destination.City?.Name, query, exactScore: 40, containsScore: 30);
      score += ScoreDescriptionField(destination.Description, query, scoreValue: 20);

      return score;
    }
    private int ScorePlace(Place place, string query)
    {
      var score = 0;

      score += ScoreName(place.Name, query);
      score += ScoreRelatedField(place.Destination?.Name, query, exactScore: 45, containsScore: 35);
      score += ScoreRelatedField(place.City?.Name, query, exactScore: 40, containsScore: 30);
      score += ScoreRelatedField(place.Type?.Name, query, exactScore: 25, containsScore: 20);
      score += ScoreDescriptionField(place.Description, query, scoreValue: 20);
      score += ScoreDescriptionField(place.Address, query, scoreValue: 20);

      return score;
      
    }
    private int ScoreEvent(Event ev, string query)
    {
      var score = 0;

      score += ScoreName(ev.Name, query);
      score += ScoreRelatedField(ev.Destination?.Name, query, exactScore: 45, containsScore: 35);
      score += ScoreRelatedField(ev.City?.Name, query, exactScore: 40, containsScore: 30);
      score += ScoreRelatedField(ev.Place?.Name, query, exactScore: 35, containsScore: 25);
      score += ScoreRelatedField(ev.Type?.Name, query, exactScore: 25, containsScore: 20);
      score += ScoreDescriptionField(ev.Description, query, scoreValue: 20);
      score += ScoreDescriptionField(ev.Address, query, scoreValue: 20);

      return score;
    }
    private int ScoreActivity(Activity activity, string query)
    {
      var score = 0;

      score += ScoreName(activity.Name, query);
      score += ScoreRelatedField(activity.Destination?.Name, query, exactScore: 45, containsScore: 35);
      score += ScoreRelatedField(activity.City?.Name, query, exactScore: 40, containsScore: 30);
      score += ScoreRelatedField(activity.Place?.Name, query, exactScore: 35, containsScore: 25);
      score += ScoreRelatedField(activity.Category?.Name, query, exactScore: 25, containsScore: 20);
      score += ScoreDescriptionField(activity.Description, query, scoreValue: 20);
      score += ScoreDescriptionField(activity.StartPoint, query, scoreValue: 20);

      return score;
    }

    private static int ScoreName(string? name, string query)
    {
      if(string.IsNullOrWhiteSpace(name)) return 0;

      if(EqualsInsensitive(name, query)) return 100;

      if(StartsWithInsensitive(name, query)) return 80;

      if(ContainsInsensitive(name, query)) return 60;

      return 0;
    }
    private static int ScoreRelatedField(string? value, string query, int exactScore, int containsScore)
    {
      if(string.IsNullOrWhiteSpace(value)) return 0;

      if(EqualsInsensitive(value, query)) return exactScore;

      if(ContainsInsensitive(value, query)) return containsScore;

      return 0;
    }
    private static int ScoreDescriptionField(string? value, string query, int scoreValue)
    {
      if(string.IsNullOrWhiteSpace(value)) return 0;

      return ContainsInsensitive(value, query) ? scoreValue : 0;
    }

    private static bool isShortQuery(string query)
    {
      return query.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length == 1;
    }

    private int ScoreDestinationHybrid(SearchProjection<Destination> hit, string query)
    {
      var score = 0;

      if(isShortQuery(query)) {
        score += 25;
        if(hit.NameSimilarity >= 0.45) score += 25;
      }
      
      score += FtsRankToScore(hit.FtsRank, weight: 120);

      if(query.Length >= 3) {
        score += SimilarityToScore(hit.NameSimilarity, weight: 65, threshold: 0.30);
        score += SimilarityToScore(hit.CitySimilarity, weight: 15, threshold: 0.35);
      }
      return score;
    }

    // private int ScorePlaceFuzzy(SearchProjection<Place> hit, string query)
    // {
    //   if(query.Length < 3) return 0;

    //   var score = 0;
    //   score += SimilarityToScore(hit.NameSimilarity, weight: 40, threshold: 0.30);
    //   score += SimilarityToScore(hit.CitySimilarity, weight: 15, threshold: 0.35);
    //   score += SimilarityToScore(hit.DestinationSimilarity, weight: 20, threshold: 0.35);
    //   score += SimilarityToScore(hit.TypeSimilarity, weight: 10, threshold: 0.35);

    //   return score;
    // }
    
    private int ScorePlaceHybrid(SearchProjection<Place> hit, string query)
    {
      var score = 0;

      score += FtsRankToScore(hit.FtsRank, weight: 120);

      if(query.Length >= 3){
        score += SimilarityToScore(hit.NameSimilarity, weight: 65, threshold: 0.30);
        score += SimilarityToScore(hit.CitySimilarity, weight: 8, threshold: 0.35);
        score += SimilarityToScore(hit.DestinationSimilarity, weight: 10, threshold: 0.35);
        score += SimilarityToScore(hit.TypeSimilarity, weight: 6, threshold: 0.35);
      }
      return score;
    }
    private int ScoreEventHybrid(SearchProjection<Event> hit, string query)
    {
      var score = 0;

      score += FtsRankToScore(hit.FtsRank, weight: 120);

      if(query.Length >= 3){
        score += SimilarityToScore(hit.NameSimilarity, weight: 65, threshold: 0.30);
        score += SimilarityToScore(hit.CitySimilarity, weight: 8, threshold: 0.35);
        score += SimilarityToScore(hit.DestinationSimilarity, weight: 10, threshold: 0.35);
        score += SimilarityToScore(hit.PlaceSimilarity, weight: 8, threshold: 0.35);
        score += SimilarityToScore(hit.TypeSimilarity, weight: 6, threshold: 0.35);
      }
      return score;
    }
    private int ScoreActivityHybrid(SearchProjection<Activity> hit, string query)
    {
      var score = 0;

      score += FtsRankToScore(hit.FtsRank, weight: 120);

      if(query.Length >= 3){ 
        score += SimilarityToScore(hit.NameSimilarity, weight: 65, threshold: 0.30);
        score += SimilarityToScore(hit.CitySimilarity, weight: 8, threshold: 0.35);
        score += SimilarityToScore(hit.DestinationSimilarity, weight: 10, threshold: 0.35);
        score += SimilarityToScore(hit.PlaceSimilarity, weight: 8, threshold: 0.35);
        score += SimilarityToScore(hit.CategorySimilarity, weight: 6, threshold: 0.35);
      }
      return score;
    }

    private static int SimilarityToScore(double? similarity, int weight, double threshold)
    {
      if(!similarity.HasValue) return 0;      
      if(similarity.Value < threshold) return 0;      

      return (int)Math.Round(similarity.Value * weight);
    }

    private static int FtsRankToScore(double ftsRank, int weight = 100)
    {
      if(ftsRank <= 0) return 0;
      return (int)Math.Round(ftsRank * weight);
    }

    // mapping metode 
    private SearchItemDto MapCandidateToSearchItem(SearchCandidate candidate)
    {
      return candidate.EntityType switch
      {
        "destination" => MapDestinationToSearchItem((Destination)candidate.Entity),
        "place" => MapPlaceToSearchItem((Place)candidate.Entity),
        "event" => MapEventToSearchItem((Event)candidate.Entity),
        "activity" => MapActivityToSearchItem((Activity)candidate.Entity),
        _ => throw new InvalidOperationException($"Unsupported entity type: {candidate.EntityType}")
      };
    }
    private SearchItemDto MapDestinationToSearchItem(Destination destination){
      var dto = new DestinationCardDto
      {
        Id = destination.Id,
        Name = destination.Name,
        Slug = destination.Slug,
        PreviewImageUrl = destination.PreviewImageUrl,
        AvgRating = destination.AvgRating,
        
        City = destination.City == null ? null : new CityRefDto
                                                 {
                                                   Id = destination.City.Id,
                                                   Name = destination.City.Name   
                                                 },
        
        Location = new LocationDto
        {
          Lat = destination.Latitude!.Value,
          Lng = destination.Longitude!.Value
        }
      };

      return new SearchItemDto
      {
        EntityType = "destination",
        Entity = dto
      };      
    }
    private SearchItemDto MapPlaceToSearchItem(Place place){
      var previewImageUrl = place.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault();

      var dto = new PlaceCardDto
      {
          Id = place.Id,
          Name = place.Name,
          Slug = place.Slug,
          
          Type = place.Type == null ? null : new TypeRefDto
                                             {
                                               Id = place.Type.Id,
                                               Name = place.Type.Name  
                                             },
          
          AvgRating = place.AvgRating,
          Address = place.Address,
          DistanceKm = null,
          PreviewImageUrl = previewImageUrl, 
          IsOpen = false,         
          PriceRange = place.PriceRange
      };
      
      return new SearchItemDto
      {
        EntityType = "place",
        Entity = dto
      };
    }
    private SearchItemDto MapEventToSearchItem(Event ev){
      var previewImageUrl = ev.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault();

            var dto = new EventCardDto
            {
                Id = ev.Id,
                Name = ev.Name,
                Slug = ev.Slug,

                Type = ev.Type == null ? null : new TypeRefDto
                {
                    Id = ev.Type.Id,
                    Name = ev.Type.Name
                },

                City = ev.City == null ? null : new CityRefDto
                {
                    Id = ev.City.Id,
                    Name = ev.City.Name
                },

                StartDatetime = ev.StartDatetime,
                EndDatetime = ev.EndDatetime,
                AvgRating = ev.AvgRating,
                Price = ev.Price,
                Address = ev.Address,
                PreviewImageUrl = previewImageUrl,
                IsFeatured = ev.IsFeatured
            };

            return new SearchItemDto
      {
        EntityType = "event",
        Entity = dto
      };
    }
    private SearchItemDto MapActivityToSearchItem(Activity activity){
      var previewImageUrl = activity.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault();
      
      var dto = new ActivityCardDto
      {
        Id = activity.Id,
        Name = activity.Name,
        Slug = activity.Slug,
        
        Category = new CategoryRefDto
        {
          Id = activity.Category.Id,
          Name = activity.Category.Name
        },

        AvgRating = activity.AvgRating,
        DurationMinutes = activity.DurationMinutes,
        Price = activity.Price,
        DifficultyLevel = activity.DifficultyLevel,
        PreviewImageUrl = previewImageUrl
      };
      
      return new SearchItemDto
      {
        EntityType = "activity",
        Entity = dto
      };
    }
    
    // deljeni helperi
    private static string NormalizeQuery(string query)
    {
      return string.Join(" ",
          query
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
      );

    }
    private static bool ContainsInsensitive(string source, string query)
    {
      return source.Contains(query, StringComparison.OrdinalIgnoreCase);
    }
    private static bool StartsWithInsensitive(string source, string query)
    {
      return source.StartsWith(query, StringComparison.OrdinalIgnoreCase);
    }
    private static bool EqualsInsensitive(string source, string query)
    {
      return string.Equals(source, query, StringComparison.OrdinalIgnoreCase);
    }
    private sealed class SearchCandidate
    {
        public string EntityType { get; set; } = null!;
        public object Entity { get; set; } = null!;
        public int Score { get; set; }
        public bool IsFeatured { get; set; }
        public decimal? AvgRating { get; set; }
        public DateTimeOffset? EventStartDatetime { get; set; }
        public string Name { get; set; } = null!;
    }
  }
}