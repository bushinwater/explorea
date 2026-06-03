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

    public async Task<SearchResultDto> SearchAsync(string? query, int limit = 10, double? userLat = null, double? userLng = null, double? radiusKm = null)
    {
      if(string.IsNullOrWhiteSpace(query)) return Empty();

      query = NormalizeQuery(query);

      if(query.Length < 2) return Empty();

      limit = Math.Clamp(limit, 1, 50);

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
        var strictScore = ScoreDestination(destination, query);
        var hybridScore = ScoreDestinationHybrid(destinationHit, query);

        candidates.Add(new SearchCandidate
        {
          EntityType = "destination",
          Entity = destination,
          StrictScore = strictScore,
          NameSimilarity = destinationHit.NameSimilarity,
          MaxWordSimilarity = Math.Max(
            CalcMaxWordSimilarity(destination.Name, query),
            CalcMaxWordSimilarity(destination.City?.Name, query)),
          RelatedSimilarity = destinationHit.CitySimilarity ?? 0,
          Score = strictScore + hybridScore,
          IsFeatured = destination.IsFeatured,
          AvgRating = destination.AvgRating,
          EventStartDatetime = null,
          Name = destination.Name
        });
      }

      foreach (var placeHit in places)
      {
        var place = placeHit.Entity;
        var strictScore = ScorePlace(place, query);
        var hybridScore = ScorePlaceHybrid(placeHit, query);

        candidates.Add(new SearchCandidate
        {
          EntityType = "place",
          Entity = place,
          StrictScore = strictScore,
          NameSimilarity = placeHit.NameSimilarity,
          MaxWordSimilarity = new[] {
            CalcMaxWordSimilarity(place.Name, query),
            CalcMaxWordSimilarity(place.City?.Name, query),
            CalcMaxWordSimilarity(place.Destination?.Name, query)
          }.Max(),
          RelatedSimilarity = new[] {
            placeHit.CitySimilarity ?? 0,
            placeHit.DestinationSimilarity ?? 0
          }.Max(),
          Score = strictScore + hybridScore,
          IsFeatured = place.IsFeatured,
          AvgRating = place.AvgRating,
          EventStartDatetime = null,
          Name = place.Name
        });
      }

      foreach (var evHit in events)
      {
        var ev = evHit.Entity;
        var strictScore = ScoreEvent(ev, query);
        var hybridScore = ScoreEventHybrid(evHit, query);

        candidates.Add(new SearchCandidate
        {
          EntityType = "event",
          Entity = ev,
          StrictScore = strictScore,
          NameSimilarity = evHit.NameSimilarity,
          MaxWordSimilarity = new[] {
            CalcMaxWordSimilarity(ev.Name, query),
            CalcMaxWordSimilarity(ev.City?.Name, query),
            CalcMaxWordSimilarity(ev.Destination?.Name, query)
          }.Max(),
          RelatedSimilarity = new[] {
            evHit.CitySimilarity ?? 0,
            evHit.DestinationSimilarity ?? 0
          }.Max(),
          Score = strictScore + hybridScore,
          IsFeatured = ev.IsFeatured,
          AvgRating = null,
          EventStartDatetime = ev.StartDatetime,
          Name = ev.Name
        });
      }

      foreach (var activityHit in activities)
      {
        var activity = activityHit.Entity;
        var strictScore = ScoreActivity(activity, query);
        var hybridScore = ScoreActivityHybrid(activityHit, query);

        candidates.Add(new SearchCandidate
        {
          EntityType = "activity",
          Entity = activity,
          StrictScore = strictScore,
          NameSimilarity = activityHit.NameSimilarity,
          MaxWordSimilarity = new[] {
            CalcMaxWordSimilarity(activity.Name, query),
            CalcMaxWordSimilarity(activity.City?.Name, query),
            CalcMaxWordSimilarity(activity.Destination?.Name, query)
          }.Max(),
          RelatedSimilarity = new[] {
            activityHit.CitySimilarity ?? 0,
            activityHit.DestinationSimilarity ?? 0
          }.Max(),
          Score = strictScore + hybridScore,
          IsFeatured = activity.IsFeatured,
          AvgRating = activity.AvgRating,
          EventStartDatetime = null,
          Name = activity.Name
        });
      }

      if (userLat.HasValue && userLng.HasValue && radiusKm.HasValue && radiusKm > 0)
      {
        candidates = candidates
          .Where(c => IsWithinRadius(c, userLat.Value, userLng.Value, radiusKm.Value))
          .ToList();
      }

      var strictCandidates = candidates
          .Where(c => c.StrictScore > 0)
          .OrderByDescending(c => c.Score)
          .ThenByDescending(c => c.IsFeatured)
          .ThenByDescending(c => c.AvgRating ?? 0m)
          .ThenBy(c => c.EventStartDatetime ?? DateTimeOffset.MaxValue)
          .ThenBy(c => c.Name)
          .ToList();

      if (strictCandidates.Any())
      {
        var strictItems = strictCandidates
            .Take(limit)
            .Select(MapCandidateToSearchItem)
            .ToList();

        return new SearchResultDto
        {
          Total = strictCandidates.Count,
          Results = strictItems
        };
      }

      var fuzzyCandidates = candidates
          .Where(c =>
              (c.NameSimilarity.HasValue && c.NameSimilarity.Value >= 0.45) ||
               c.MaxWordSimilarity >= 0.72 ||
               c.RelatedSimilarity >= 0.45)
          .OrderByDescending(c => c.MaxWordSimilarity)
          .ThenByDescending(c => c.NameSimilarity ?? 0)
          .ThenByDescending(c => c.Score)
          .ThenByDescending(c => c.IsFeatured)
          .ThenByDescending(c => c.AvgRating ?? 0m)
          .ThenBy(c => c.EventStartDatetime ?? DateTimeOffset.MaxValue)
          .ThenBy(c => c.Name)
          .ToList();

      var fuzzyItems = fuzzyCandidates
          .Take(limit)
          .Select(MapCandidateToSearchItem)
          .ToList();

      return new SearchResultDto
      {
        Total = fuzzyCandidates.Count,
        Results = fuzzyItems
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

      if(ContainsWholeWord(name, query)) return 80;

      if(StartsWithWord(name, query)) return 75;

      return 0;
    }
    private static int ScoreRelatedField(string? value, string query, int exactScore, int containsScore)
    {
      if(string.IsNullOrWhiteSpace(value)) return 0;

      if(EqualsInsensitive(value, query)) return exactScore;

      if(ContainsWholeWord(value, query)) return containsScore;

      if(StartsWithWord(value, query)) return Math.Max(containsScore - 5, 1);

      return 0;
    }
    private static int ScoreDescriptionField(string? value, string query, int scoreValue)
    {
      if(string.IsNullOrWhiteSpace(value)) return 0;

      if(query.Length < 4) return 0;

      return ContainsWholeWord(value, query) ? scoreValue : 0;
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

    private static double CalcMaxWordSimilarity(string? value, string query)
    {
      if(string.IsNullOrWhiteSpace(value) || string.IsNullOrWhiteSpace(query)) return 0;

      var tokens = value
          .ToLowerInvariant()
          .Split(new[] { ' ', '-', '_', ',', '.', ';', ':', '/', '\\', '(', ')', '[', ']', '{', '}', '!', '?' },
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

      var q = query.ToLowerInvariant();

      double max = 0;

      foreach (var token in tokens)
      {
        var sim = DiceSimilarity(token, q);
        if(sim > max) max = sim;
      }

      return max;
    }

    private static double DiceSimilarity(string a, string b)
    {
      if(string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return 0;

      if(a == b) return 1.0;

      var aBigrams = GetBigrams(a);
      var bBigrams = GetBigrams(b);

      if(aBigrams.Count == 0 || bBigrams.Count == 0) return 0;

      var intersection = aBigrams.Intersect(bBigrams).Count();
      return (2.0 * intersection) / (aBigrams.Count + bBigrams.Count);
    }

    private static List<string> GetBigrams(string s)
    {
      var result = new List<string>();

      if(s.Length < 2) return result;

      for (int i = 0; i < s.Length - 1; i++) result.Add(s.Substring(i, 2));

      return result;
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
        PreviewImageUrl = destination.PreviewImageUrl ?? destination.HeroImageUrl,
        AvgRating = destination.AvgRating,
        Address = destination.Address,

        TypeId = destination.TypeId,

        City = destination.City == null ? null : new CityRefDto
                                                 {
                                                   Id = destination.City.Id,
                                                   Name = destination.City.Name,
                                                   RegionId = destination.City.RegionId
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

          City = place.City == null ? null : new CityRefDto
          {
              Id = place.City.Id,
              Name = place.City.Name,
              RegionId = place.City.RegionId
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
                    Name = ev.City.Name,
                    RegionId = ev.City.RegionId
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

    // Radius filtering helpers
    private static bool IsWithinRadius(SearchCandidate candidate, double lat, double lng, double radiusKm)
    {
      var (cLat, cLng) = candidate.EntityType switch
      {
        "destination" => GetCoords((Destination)candidate.Entity),
        "place"       => GetCoords((Place)candidate.Entity),
        "event"       => GetCoords((Event)candidate.Entity),
        "activity"    => GetCoords((Activity)candidate.Entity),
        _             => ((double?)null, (double?)null)
      };
      if (!cLat.HasValue || !cLng.HasValue) return true;
      return HaversineKm(lat, lng, cLat.Value, cLng.Value) <= radiusKm;
    }

    private static (double? lat, double? lng) GetCoords(Destination d) => (d.Latitude, d.Longitude);
    private static (double? lat, double? lng) GetCoords(Place p) => (p.Latitude, p.Longitude);
    private static (double? lat, double? lng) GetCoords(Event e) => (e.Latitude, e.Longitude);
    private static (double? lat, double? lng) GetCoords(Activity a) => (a.Latitude, a.Longitude);

    private static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
      const double R = 6371.0;
      var dLat = (lat2 - lat1) * Math.PI / 180;
      var dLng = (lng2 - lng1) * Math.PI / 180;
      var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
            * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
      return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
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

    private static string[] Tokenize(string? value)
    {
      if(string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();

      return value
          .ToLowerInvariant()
          .Split(new[] {' ', '-', '_', ',', '.', ':', ';', '/', '\\', '(', ')', '[', ']', '{', '}', '!', '?' },
              StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
          );
    }

    private static bool ContainsWholeWord(string? source, string query)
    {
      if(string.IsNullOrWhiteSpace(source)) return false;

      var tokens = Tokenize(source);
      return tokens.Contains(query.ToLowerInvariant());
    }

    private static bool StartsWithWord(string? source, string query)
    {
      if(string.IsNullOrWhiteSpace(source)) return false;

      var q = query.ToLowerInvariant();
      var tokens = Tokenize(source);
      return tokens.Any(t => t.StartsWith(q));
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
        public int StrictScore { get; set; }
        public double? NameSimilarity { get; set; }
        public double MaxWordSimilarity { get; set; }
        public double RelatedSimilarity { get; set; }
        public bool IsFeatured { get; set; }
        public decimal? AvgRating { get; set; }
        public DateTimeOffset? EventStartDatetime { get; set; }
        public string Name { get; set; } = null!;
    }
  }
}
