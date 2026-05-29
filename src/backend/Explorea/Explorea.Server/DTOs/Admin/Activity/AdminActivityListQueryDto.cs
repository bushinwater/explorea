namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityListQueryDto
    {
        public string? Search { get; set; }

        public List<Guid>? Ids { get; set; }

        public int? RegionId { get; set; }
        public int? CityId { get; set; }
        public int? CategoryId { get; set; }

        // difficulty values:
        // easy, medium, hard
        public string? DifficultyLevel { get; set; }

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

        public bool? IsFeatured { get; set; }

        // true = only free (price IS NULL), null = all
        public bool? IsFree { get; set; }

        // "key:value" pairs applied as JSONB contains on ExtraData
        public List<string>? ExtraFilters { get; set; }

        // "updatedAt_desc" | "updatedAt_asc" | null
        public string? SortBy { get; set; }

        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 17;
    }
}