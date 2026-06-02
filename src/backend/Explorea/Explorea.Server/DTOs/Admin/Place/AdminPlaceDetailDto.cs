namespace Explorea.API.DTOs.Admin.Place
{
    using Explorea.API.DTOs.Admin;

    public class AdminPlaceDetailDto
    {
        public Guid Id { get; set; }
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
        public decimal? PricePerNight { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? WebsiteUrl { get; set; }

        public decimal AvgRating { get; set; }
        public bool IsFeatured { get; set; }
        public string Status { get; set; } = "approved";

        public string? Type { get; set; }
        public string? City { get; set; }
        public string? Region { get; set; }
        public string? Destination { get; set; }
        public string? Country { get; set; }
        public Dictionary<string, string>? ExtraFilters { get; set; }
        public Guid? CreatedBy { get; set; }

        public List<AdminPlaceImageDto> Images { get; set; } = new();
        public List<AdminPlaceAmenityDto> Amenities { get; set; } = new();
        public List<AdminPlaceWorkingDayDto> WorkingDays { get; set; } = new();
        public List<OwnerSubmissionDocumentDto> Documents { get; set; } = new();

        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class AdminPlaceImageDto
    {
        public Guid Id { get; set; }
        public string ImageUrl { get; set; } = null!;
        public string? Caption { get; set; }
        public int SortOrder { get; set; }
    }

    public class AdminPlaceAmenityDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
    }

    public class AdminPlaceWorkingDayDto
    {
        public Guid Id { get; set; }
        public short DayOfWeek { get; set; }
        public bool IsClosed { get; set; }
        public string? Note { get; set; }
        public List<AdminPlaceWorkingHourIntervalDto> Intervals { get; set; } = new();
    }

    public class AdminPlaceWorkingHourIntervalDto
    {
        public Guid Id { get; set; }
        public TimeOnly OpensAt { get; set; }
        public TimeOnly ClosesAt { get; set; }
    }
}
