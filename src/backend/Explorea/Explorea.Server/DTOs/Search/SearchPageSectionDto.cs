namespace Explorea.API.DTOs.Search
{
  public class SearchPageSectionDto
  {
    public string Key {get; set;} = null!;
    public string Title {get; set;} = null!;
    public string EntityType {get; set;} = null!;
    public List<object> Items {get; set;} = new();
  }
}