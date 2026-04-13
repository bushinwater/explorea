namespace Explorea.API.DTOs.Event
{
    public class GetEventCalendarQueryDto
    {
        public int Year { get; set; }
        public int Month { get; set; }

        public int? CityId { get; set; }
        public int? TypeId { get; set; }

        public DateOnly? SelectedDate { get; set; }

        public bool? FreeOnly { get; set; }

        public string SortBy { get; set; } = EventSortOptions.Date;

        public double? UserLat { get; set; }
        public double? UserLng { get; set; }
    }
}