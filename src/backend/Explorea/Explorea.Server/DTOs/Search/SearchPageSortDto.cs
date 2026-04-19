namespace Explorea.API.DTOs.Search
{
  public class SearchPageSortDto
  {
    public string? Selected {get; set;}
    public List<string> Available {get; set;} = new();
  }
}