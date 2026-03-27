namespace Explorea.API.DTOs.Event
{
    public class CalendarDayDto
    {
        public DateOnly Date { get; set; }
        public int Count { get; set; }
        public List<EventCardDto> Events { get; set; } = new();
    }
}