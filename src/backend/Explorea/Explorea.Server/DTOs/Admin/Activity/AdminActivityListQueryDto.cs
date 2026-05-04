namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityListQueryDto
    {
        public int? RegionId { get; set; }
        public int? CityId { get; set; }
        public int? CategoryId { get; set; }

        // duration values:
        // up_to_2h, from_2h_to_6h, multi_day
        public string? Duration { get; set; }

        // popularity values:
        // low, medium, high
        public string? Popularity { get; set; }

        // status values:
        // active, inactive
        public string? Status { get; set; }

        public decimal? MinAvgRating { get; set; }

        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}