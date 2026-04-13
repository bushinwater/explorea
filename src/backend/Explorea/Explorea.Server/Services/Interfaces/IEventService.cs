using Explorea.API.DTOs.Event;

namespace Explorea.Server.Services.Interfaces
{
    public interface IEventService
    {
        Task<(List<EventCardDto> Items, int Total)> GetEventsAsync(GetEventsQueryDto query);

        Task<EventDetailDto?> GetBySlugAsync(string slug);

        Task<List<CalendarDayDto>> GetCalendarAsync(GetEventCalendarQueryDto query);
    }
}