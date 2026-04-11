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

            var (events, total) = await _eventRepository.GetPagedAsync(
                cityId: query.CityId,
                typeId: null,
                from: null,
                to: null,
                free: null,
                page: page,
                pageSize: pageSize
            );

            var items = events
                .OrderBy(e => e.StartDatetime)
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
            return new List<CalendarDayDto>();
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
    }
}