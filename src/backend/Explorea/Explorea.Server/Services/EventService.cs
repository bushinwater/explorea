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
            // logika ide kasnije
            return (new List<EventCardDto>(), 0);
        }

        public async Task<EventDetailDto?> GetBySlugAsync(string slug)
        {
            // logika ide kasnije
            return null;
        }

        public async Task<List<CalendarDayDto>> GetCalendarAsync(GetEventCalendarQueryDto query)
        {
            // logika ide kasnije
            return new List<CalendarDayDto>();
        }
    }
}