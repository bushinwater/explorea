using Explorea.API.Models;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Review;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
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
                var selectedDateUtc = new DateTime(
                    query.Date.Value.Year,
                    query.Date.Value.Month,
                    query.Date.Value.Day,
                    0, 0, 0,
                    DateTimeKind.Utc);

                var nextDateUtc = selectedDateUtc.AddDays(1);

                from = new DateTimeOffset(selectedDateUtc);
                to = new DateTimeOffset(nextDateUtc);
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

            var sortedEvents = SortEvents(events, query.SortBy, query.UserLat, query.UserLng);

            var pagedItems = sortedEvents
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(MapToEventCardDto)
                .ToList();

            return (pagedItems, total);
        }

        public async Task<EventDetailDto?> GetBySlugAsync(string slug)
        {
            var entity = await _eventRepository.GetEventDetailsBySlugAsync(slug);

            if (entity == null)
                return null;

            var reviews = await _eventRepository.GetEventReviewsAsync(entity.Id, 15);
            var similarEvents = await _eventRepository.GetSimilarEventsAsync(entity, 12);

            var detail = new EventDetailDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Slug = entity.Slug,
                Description = entity.Description,
                StartDatetime = entity.StartDatetime,
                EndDatetime = entity.EndDatetime,
                AvgRating = entity.AvgRating,
                Price = entity.Price,
                Address = entity.Address,
                LocationName = entity.Place?.Name ?? entity.Address,
                TicketUrl = entity.TicketUrl,
                IsFeatured = entity.IsFeatured,
                Popularity = entity.Popularity,
                PreviewImageUrl = entity.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),

                Type = entity.Type == null
                    ? null
                    : new TypeRefDto
                    {
                        Id = entity.Type.Id,
                        Name = entity.Type.Name
                    },

                City = entity.City == null
                    ? null
                    : new CityRefDto
                    {
                        Id = entity.City.Id,
                        Name = entity.City.Name
                    },

                Country = entity.Country == null
                    ? null
                    : new CountryRefDto
                    {
                        Id = entity.Country.Id,
                        Name = entity.Country.Name
                    },

                Location =
                    (entity.Latitude.HasValue && entity.Longitude.HasValue)
                        ? new LocationDto
                        {
                            Lat = entity.Latitude.Value,
                            Lng = entity.Longitude.Value
                        }
                        : entity.Place != null && entity.Place.Latitude.HasValue && entity.Place.Longitude.HasValue
                            ? new LocationDto
                            {
                                Lat = entity.Place.Latitude.Value,
                                Lng = entity.Place.Longitude.Value
                            }
                            : entity.Destination != null && entity.Destination.Latitude.HasValue && entity.Destination.Longitude.HasValue
                                ? new LocationDto
                                {
                                    Lat = entity.Destination.Latitude.Value,
                                    Lng = entity.Destination.Longitude.Value
                                }
                                : null,

                Images = entity.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new EventImageDto
                    {
                        ImageUrl = i.ImageUrl,
                        Caption = i.Caption,
                        SortOrder = i.SortOrder
                    })
                    .ToList(),

                Reviews = reviews
                    .Select(r => new ReviewDto
                    {
                        Id = r.Id,
                        Rating = r.Rating,
                        Comment = r.Comment,
                        CreatedAt = r.CreatedAt,
                        User = new ReviewUserDto
                        {
                            Id = r.User.Id,
                            FirstName = r.User.FirstName,
                            LastName = r.User.LastName,
                            TravelerRank = r.User.TravelerRank,
                            ProfileImageUrl = r.User.ProfileImageUrl
                        }
                    })
                    .ToList(),

                SimilarEvents = similarEvents
                    .Where(e => e.Id != entity.Id)
                    .Select(MapToEventCardDto)
                    .ToList()
            };

            return detail;
        }

        public async Task<List<CalendarDayDto>> GetCalendarAsync(GetEventCalendarQueryDto query)
        {
            var events = await _eventRepository.GetByMonthFilteredAsync(
                query.Year,
                query.Month,
                query.CityId,
                query.TypeId,
                query.FreeOnly);

            var monthStart = new DateOnly(query.Year, query.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var eventsByDay = new Dictionary<DateOnly, List<Event>>();

            foreach (var e in events)
            {
                var eventStartDate = DateOnly.FromDateTime(e.StartDatetime.UtcDateTime.Date);
                var eventEndDate = DateOnly.FromDateTime(e.EndDatetime.UtcDateTime.Date);

                var effectiveStart = eventStartDate < monthStart ? monthStart : eventStartDate;
                var effectiveEnd = eventEndDate > monthEnd ? monthEnd : eventEndDate;

                for (var day = effectiveStart; day <= effectiveEnd; day = day.AddDays(1))
                {
                    if (!eventsByDay.ContainsKey(day))
                        eventsByDay[day] = new List<Event>();

                    eventsByDay[day].Add(e);
                }
            }

            var groupedDays = eventsByDay
                .OrderBy(x => x.Key);

            if (query.SelectedDate.HasValue)
            {
                groupedDays = groupedDays
                    .Where(x => x.Key == query.SelectedDate.Value)
                    .OrderBy(x => x.Key);
            }

            var calendarDays = groupedDays
                .Select(dayGroup =>
                {
                    var sortedEvents = SortEvents(
                        dayGroup.Value,
                        query.SortBy,
                        query.UserLat,
                        query.UserLng);

                    return new CalendarDayDto
                    {
                        Date = dayGroup.Key,
                        Count = dayGroup.Value.Count,
                        Events = sortedEvents
                            .Select(MapToEventCardDto)
                            .ToList()
                    };
                })
                .ToList();

            return calendarDays;
        }

        private static IEnumerable<Event> SortEvents(
            IEnumerable<Event> events,
            string? sortBy,
            double? userLat,
            double? userLng)
        {
            return sortBy?.ToLower() switch
            {
                EventSortOptions.Popularity => events
                    .OrderByDescending(e => e.Popularity)
                    .ThenByDescending(e => e.IsFeatured)
                    .ThenBy(e => e.StartDatetime),

                EventSortOptions.Nearest when userLat.HasValue && userLng.HasValue => events
                    .OrderBy(e => GetDistanceInKm(
                        userLat.Value,
                        userLng.Value,
                        e.Latitude,
                        e.Longitude))
                    .ThenBy(e => e.StartDatetime),

                _ => events
                    .OrderBy(e => e.StartDatetime)
            };
        }

        private static EventCardDto MapToEventCardDto(Event e)
        {
            return new EventCardDto
            {
                Id = e.Id,
                Name = e.Name,
                Slug = e.Slug,
                StartDatetime = e.StartDatetime,
                EndDatetime = e.EndDatetime,
                AvgRating = e.AvgRating,
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
                    },

                Latitude  = e.Latitude
                    ?? (e.Destination?.Latitude)
                    ?? (e.Place?.Latitude),
                Longitude = e.Longitude
                    ?? (e.Destination?.Longitude)
                    ?? (e.Place?.Longitude)
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