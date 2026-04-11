using System.ComponentModel;
using System.Text.Json;
using Explorea.Server.Repositories.Interfaces;
using ModelContextProtocol.Server;

namespace Explorea.Server.McpTools
{
    [McpServerToolType]
    public class DiscoveryTools(
        IEventRepository eventRepository,
        IActivityRepository activityRepository,
        IPlaceRepository placeRepository)
    {
        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        [McpServerTool(Name = "get_upcoming_events"), Description(
            "Returns a list of upcoming events, optionally filtered by city, event type, date range, or price. " +
            "By default returns only future events ordered by start date. " +
            "Use this when the user asks about events, concerts, festivals, or things happening soon.")]
        public async Task<string> GetUpcomingEvents(
            [Description("City ID to filter events by city (optional)")] int? cityId = null,
            [Description("Event type ID to filter by type (optional)")] int? typeId = null,
            [Description("Show only events starting on or after this date (ISO 8601, optional - defaults to now)")] DateTimeOffset? from = null,
            [Description("Show only events ending on or before this date (ISO 8601, optional)")] DateTimeOffset? to = null,
            [Description("Set to true to show only free events (optional)")] bool? isFree = null,
            [Description("Maximum number of events to return (1-100, default 20)")] int limit = 20)
        {
            limit = Math.Clamp(limit, 1, 100);

            var effectiveFrom = from ?? DateTimeOffset.UtcNow;

            var (items, total) = await eventRepository.GetPagedAsync(
                cityId, typeId, effectiveFrom, to, isFree, page: 1, pageSize: limit);

            var result = new
            {
                total,
                events = items.Select(e => new
                {
                    e.Name,
                    e.Slug,
                    type = e.Type?.Name,
                    startDatetime = e.StartDatetime,
                    endDatetime = e.EndDatetime,
                    price = e.Price,
                    isFree = e.Price == null || e.Price == 0,
                    address = e.Address,
                    city = e.City?.Name,
                    e.IsFeatured
                })
            };

            return JsonSerializer.Serialize(result, _json);
        }

        [McpServerTool(Name = "get_activities"), Description(
            "Returns a list of activities (hiking, climbing, cycling, etc.), " +
            "optionally filtered by destination, category, or difficulty level. " +
            "Use this when the user asks for things to do, outdoor activities, or sport experiences.")]
        public async Task<string> GetActivities(
            [Description("Destination ID to filter activities at a specific destination (optional)")] Guid? destinationId = null,
            [Description("Activity category ID to filter by category (optional)")] int? categoryId = null,
            [Description("Difficulty level to filter by: 'easy', 'moderate', 'hard', 'expert' (optional)")] string? difficulty = null,
            [Description("Maximum number of activities to return (1-100, default 20)")] int limit = 20)
        {
            limit = Math.Clamp(limit, 1, 100);

            var (items, total) = await activityRepository.GetPagedAsync(
                destinationId, categoryId, seasonId: null, difficulty, page: 1, pageSize: limit);

            var result = new
            {
                total,
                activities = items.Select(a => new
                {
                    a.Name,
                    a.Slug,
                    category = a.Category?.Name,
                    a.DifficultyLevel,
                    durationMinutes = a.DurationMinutes,
                    distanceKm = a.DistanceKm,
                    price = a.Price,
                    avgRating = a.AvgRating,
                    a.IsFeatured
                })
            };

            return JsonSerializer.Serialize(result, _json);
        }

        [McpServerTool(Name = "get_places"), Description(
            "Returns a list of places (restaurants, hotels, cafes, museums, etc.), " +
            "optionally filtered by destination, city, place type, or minimum rating. " +
            "Use this when the user asks where to eat, stay, or visit at a specific location.")]
        public async Task<string> GetPlaces(
            [Description("Destination ID to filter places at a specific destination (optional)")] Guid? destinationId = null,
            [Description("City ID to filter places in a specific city (optional)")] int? cityId = null,
            [Description("Place type ID to filter by type (e.g. restaurant, hotel) (optional)")] int? typeId = null,
            [Description("Minimum average rating to filter by (0.0 - 5.0, optional)")] decimal? minRating = null,
            [Description("Maximum number of places to return (1-100, default 20)")] int limit = 20)
        {
            limit = Math.Clamp(limit, 1, 100);

            var (items, total) = await placeRepository.GetPagedAsync(
                destinationId, cityId, typeId, minRating, isOpen: null, page: 1, pageSize: limit);

            var result = new
            {
                total,
                places = items.Select(p => new
                {
                    p.Name,
                    p.Slug,
                    type = p.Type?.Name,
                    avgRating = p.AvgRating,
                    address = p.Address,
                    priceRange = p.PriceRange,
                    city = p.City?.Name,
                    p.IsFeatured
                })
            };

            return JsonSerializer.Serialize(result, _json);
        }
    }
}
