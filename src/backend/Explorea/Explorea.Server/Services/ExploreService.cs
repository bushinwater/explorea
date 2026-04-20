using Explorea.API.DTOs.Explore;
using Explorea.API.Models;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Services
{
    public class ExploreService : IExploreService
    {
        private readonly IExploreRepository _exploreRepository;

        public ExploreService(IExploreRepository exploreRepository)
        {
            _exploreRepository = exploreRepository;
        }

        public async Task<ExploreMapResultDto> GetMapMarkersAsync(
            double? lat, double? lng, double radiusKm, string type, int limit,
            decimal? minRating, bool? openNow)
        {
            radiusKm = Math.Clamp(radiusKm, 1, 200);
            limit = Math.Clamp(limit, 1, 500);

            var perTypeLimit = type == "all" ? limit / 4 + 1 : limit;

            var markers = new List<ExploreMarkerDto>();

            if (type == "all" || type == "destination")
            {
                var destinations = await _exploreRepository
                    .GetNearbyDestinationsAsync(lat, lng, radiusKm, perTypeLimit, minRating);

                markers.AddRange(destinations.Select(MapDestination));
            }

            if (type == "all" || type == "place")
            {
                var places = await _exploreRepository
                    .GetNearbyPlacesAsync(lat, lng, radiusKm, perTypeLimit, minRating, openNow);

                markers.AddRange(places.Select(MapPlace));
            }

            if (type == "all" || type == "event")
            {
                var events = await _exploreRepository
                    .GetNearbyEventsAsync(lat, lng, radiusKm, perTypeLimit);

                markers.AddRange(events.Select(MapEvent));
            }

            if (type == "all" || type == "activity")
            {
                var activities = await _exploreRepository
                    .GetNearbyActivitiesAsync(lat, lng, radiusKm, perTypeLimit, minRating);

                markers.AddRange(activities.Select(MapActivity));
            }

            return new ExploreMapResultDto
            {
                Total = markers.Count,
                Markers = markers
            };
        }

        public async Task<ExploreMarkerDto?> GetMarkerBySlugAsync(string entityType, string slug)
        {
            return entityType switch
            {
                "destination" => (await _exploreRepository.GetDestinationBySlugAsync(slug)) is { } d ? MapDestination(d) : null,
                "place"       => (await _exploreRepository.GetPlaceBySlugAsync(slug))       is { } p ? MapPlace(p)       : null,
                "event"       => (await _exploreRepository.GetEventBySlugAsync(slug))       is { } e ? MapEvent(e)       : null,
                "activity"    => (await _exploreRepository.GetActivityBySlugAsync(slug))    is { } a ? MapActivity(a)    : null,
                _             => null,
            };
        }

        private static ExploreMarkerDto MapDestination(Destination d) => new()
        {
            EntityType = "destination",
            Id = d.Id,
            Slug = d.Slug,
            Name = d.Name,
            Lat = d.Latitude ?? 0,
            Lng = d.Longitude ?? 0,
            PreviewImageUrl = d.HeroImageUrl,
            AvgRating = d.AvgRating,
            Subtitle = d.City?.Name
        };

        private static ExploreMarkerDto MapPlace(Place p) => new()
        {
            EntityType = "place",
            Id = p.Id,
            Slug = p.Slug,
            Name = p.Name,
            Lat = p.Latitude ?? 0,
            Lng = p.Longitude ?? 0,
            PreviewImageUrl = p.Images
                .OrderBy(i => i.SortOrder)
                .Select(i => i.ImageUrl)
                .FirstOrDefault(),
            AvgRating = p.AvgRating,
            Subtitle = p.Type?.Name,
            CategoryId = p.TypeId
        };

        private static ExploreMarkerDto MapEvent(Event e) => new()
        {
            EntityType = "event",
            Id = e.Id,
            Slug = e.Slug,
            Name = e.Name,
            Lat = e.Latitude ?? 0,
            Lng = e.Longitude ?? 0,
            PreviewImageUrl = e.Images
                .OrderBy(i => i.SortOrder)
                .Select(i => i.ImageUrl)
                .FirstOrDefault(),
            Subtitle = e.Type?.Name,
            CategoryId = e.TypeId,
            Price = e.Price,
            StartDatetime = e.StartDatetime
        };

        private static ExploreMarkerDto MapActivity(Activity a) => new()
        {
            EntityType = "activity",
            Id = a.Id,
            Slug = a.Slug,
            Name = a.Name,
            Lat = a.Latitude ?? 0,
            Lng = a.Longitude ?? 0,
            PreviewImageUrl = a.Images
                .OrderBy(i => i.SortOrder)
                .Select(i => i.ImageUrl)
                .FirstOrDefault(),
            AvgRating = a.AvgRating,
            Subtitle = a.Category?.Name,
            CategoryId = a.CategoryId,
            Price = a.Price
        };
    }
}
