namespace Explorea.API.DTOs.Search
{
  public class SearchPageAllResponseDto
  {
    public string Tab {get; set;} = "all";
    public SearchPageSummaryDto Summary {get; set;} = new();
    public List<SearchPageSectionDto> Sections {get; set;} = new();
  }
}