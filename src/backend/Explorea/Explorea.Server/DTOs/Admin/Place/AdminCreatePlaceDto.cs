namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminCreatePlaceDto
    {
        public Guid? DestinationId { get; set; }
        public int? CityId { get; set; }
        public int? CountryId { get; set; }
        public int? TypeId { get; set; }

        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string? Description { get; set; }
        public string? Address { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public string? PriceRange { get; set; }
        public string? Phone { get; set; }
        public string? WebsiteUrl { get; set; }

        public bool IsFeatured { get; set; }

        public List<AdminCreatePlaceImageDto> Images { get; set; } = new();
        public List<int> AmenityIds { get; set; } = new();
        public List<AdminCreatePlaceWorkingDayDto> WorkingDays { get; set; } = new();
    }

    public class AdminCreatePlaceImageDto
    {
        public string ImageUrl { get; set; } = null!;
        public string? Caption { get; set; }
        public int SortOrder { get; set; }
    }

    public class AdminCreatePlaceWorkingDayDto
    {
        public short DayOfWeek { get; set; }
        public bool IsClosed { get; set; }
        public string? Note { get; set; }
        public List<AdminCreatePlaceWorkingHourIntervalDto> Intervals { get; set; } = new();
    }

    public class AdminCreatePlaceWorkingHourIntervalDto
    {
        public TimeOnly OpensAt { get; set; }
        public TimeOnly ClosesAt { get; set; }
    }
}