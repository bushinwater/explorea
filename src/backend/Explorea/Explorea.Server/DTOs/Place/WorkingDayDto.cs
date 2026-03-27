namespace Explorea.API.DTOs.Place
{
    public class WorkingDayDto
    {
        public int DayOfWeek { get; set; }
        public bool IsClosed { get; set; }
        public List<WorkingHourIntervalDto> Intervals { get; set; } = new();
    }

    public class WorkingHourIntervalDto
    {
        public TimeOnly OpensAt { get; set; }
        public TimeOnly ClosesAt { get; set; }
    }
}