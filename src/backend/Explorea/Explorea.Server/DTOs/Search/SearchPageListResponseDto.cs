namespace Explorea.API.DTOs.Search
{
  public class SearchPageListResponseDto
  {
    public string Tab {get; set;} = null!;
    public SearchPageSummaryDto Summary {get; set;} = new();
    public List<object> Items {get; set;} = new();
    public SearchPagePaginationDto Pagination {get; set;} = new();
    public SearchPageSortDto Sort {get; set;} = new();
    public SearchPageAppliedFilterDto AppliedFilters {get; set;} = new();
  }
}