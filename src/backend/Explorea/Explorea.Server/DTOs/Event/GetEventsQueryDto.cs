namespace Explorea.API.DTOs.Event
{
    public class GetEventsQueryDto
    {
        public int? CityId { get; set; }
        public int? TypeId { get; set; }

        public DateOnly? Date { get; set; }

        public bool? FreeOnly { get; set; }

        public string SortBy { get; set; } = EventSortOptions.Date;

        public double? UserLat { get; set; }
        public double? UserLng { get; set; }

        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }
}