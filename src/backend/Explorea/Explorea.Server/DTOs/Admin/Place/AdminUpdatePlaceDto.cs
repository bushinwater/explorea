namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminUpdatePlaceDto
    {
        public Guid? DestinationId { get; set; }
        public int? CityId { get; set; }
        public int? CountryId { get; set; }
        public int? TypeId { get; set; }

        public string? Name { get; set; }
        public string? Slug { get; set; }
        public string? Description { get; set; }
        public string? Address { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public string? PriceRange { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? WebsiteUrl { get; set; }

        public bool? IsFeatured { get; set; }
        public string? ApprovalStatus { get; set; }

        // Ako dođe lista, tretiramo je kao full replace
        public List<AdminCreatePlaceImageDto>? Images { get; set; }
        public List<int>? AmenityIds { get; set; }
        public List<AdminCreatePlaceWorkingDayDto>? WorkingDays { get; set; }
    }
}