using Explorea.API.Models;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Event;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services.Implementations
{
    public class EventService : IEventService
    {
        private readonly IEventRepository _eventRepository;

        public EventService(IEventRepository eventRepository)
        {
            _eventRepository = eventRepository;
        }

        public async Task<(List<EventCardDto> Items, int Total)> GetEventsAsync(GetEventsQueryDto query)
        {
            var page = query.Page < 1 ? 1 : query.Page;
            var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

            DateTimeOffset? from = null;
            DateTimeOffset? to = null;

            if (query.Date.HasValue)
            {
                var selectedDate = query.Date.Value.ToDateTime(TimeOnly.MinValue);
                var nextDate = query.Date.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);

                from = new DateTimeOffset(selectedDate);
                to = new DateTimeOffset(nextDate);
            }

            var (events, total) = await _eventRepository.GetPagedAsync(
                cityId: query.CityId,
                typeId: query.TypeId,
                from: from,
                to: to,
                free: query.FreeOnly,
                page: page,
                pageSize: pageSize
            );

            var sortedEvents = query.SortBy?.ToLower() switch
            {
                EventSortOptions.Popularity => events
                    .OrderByDescending(e => e.IsFeatured)
                    .ThenByDescending(e => e.Popularity)
                    .ThenBy(e => e.StartDatetime),

                EventSortOptions.Nearest when query.UserLat.HasValue && query.UserLng.HasValue => events
                    .OrderBy(e => GetDistanceInKm(
                        query.UserLat.Value,
                        query.UserLng.Value,
                        e.Latitude,
                        e.Longitude))
                    .ThenBy(e => e.StartDatetime),

                _ => events
                    .OrderBy(e => e.StartDatetime)
            };

            var items = sortedEvents
                .Select(MapToEventCardDto)
                .ToList();

            return (items, total);
        }

        public async Task<EventDetailDto?> GetBySlugAsync(string slug)
        {
            return null;
        }

        public async Task<List<CalendarDayDto>> GetCalendarAsync(GetEventCalendarQueryDto query)
        {
            var events = await _eventRepository.GetByMonthFilteredAsync(
                query.Year,
                query.Month,
                query.CityId,
                query.TypeId,
                query.FreeOnly);

            var calendarDays = events
                .GroupBy(e => DateOnly.FromDateTime(e.StartDatetime.Date))
                .OrderBy(g => g.Key)
                .Select(g => new CalendarDayDto
                {
                    Date = g.Key,
                    Count = g.Count(),
                    Events = g
                        .OrderBy(e => e.StartDatetime)
                        .Select(MapToEventCardDto)
                        .ToList()
                })
                .ToList();

            return calendarDays;
        }

        private static EventCardDto MapToEventCardDto(API.Models.Event e)
        {
            return new EventCardDto
            {
                Id = e.Id,
                Name = e.Name,
                Slug = e.Slug,
                StartDatetime = e.StartDatetime,
                EndDatetime = e.EndDatetime,
                Price = e.Price,
                Address = e.Address,
                IsFeatured = e.IsFeatured,
                Popularity = e.Popularity,
                PreviewImageUrl = e.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),

                Type = e.Type == null
                    ? null
                    : new TypeRefDto
                    {
                        Id = e.Type.Id,
                        Name = e.Type.Name
                    },

                City = e.City == null
                    ? null
                    : new CityRefDto
                    {
                        Id = e.City.Id,
                        Name = e.City.Name
                    },

                Country = e.Country == null
                    ? null
                    : new CountryRefDto
                    {
                        Id = e.Country.Id,
                        Name = e.Country.Name
                    }
            };
        }

        private static double GetDistanceInKm(
            double userLat,
            double userLng,
            double? eventLat,
            double? eventLng)
        {
            if (!eventLat.HasValue || !eventLng.HasValue)
                return double.MaxValue;

            const double earthRadiusKm = 6371;

            var dLat = DegreesToRadians(eventLat.Value - userLat);
            var dLng = DegreesToRadians(eventLng.Value - userLng);

            var lat1 = DegreesToRadians(userLat);
            var lat2 = DegreesToRadians(eventLat.Value);

            var a =
                Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1) * Math.Cos(lat2) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);

            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return earthRadiusKm * c;
        }

        private static double DegreesToRadians(double degrees)
        {
            return degrees * Math.PI / 180.0;
        }
    }
}