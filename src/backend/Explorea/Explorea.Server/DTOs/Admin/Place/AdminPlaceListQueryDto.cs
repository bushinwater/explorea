namespace Explorea.API.DTOs.Admin.Place
{
    public class AdminPlaceListQueryDto
    {
        public string? Search { get; set; }
        public int? TypeId { get; set; }
        public string? Status { get; set; }
        public int? Region { get; set; }
        public decimal? MinRating { get; set; }
        public Guid? DestinationId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
