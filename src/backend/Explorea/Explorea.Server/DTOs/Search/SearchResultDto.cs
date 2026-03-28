namespace Explorea.API.DTOs.Search
{
    public class SearchResultDto
    {
        public int Total { get; set; }
        public List<SearchItemDto> Results { get; set; } = new();
    }

    public class SearchItemDto
    {
        public string EntityType { get; set; } = null!;
        public object Entity { get; set; } = null!;
    }
}