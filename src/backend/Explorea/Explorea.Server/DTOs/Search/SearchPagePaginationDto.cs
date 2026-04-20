namespace Explorea.API.DTOs.Search
{
  public class SearchPagePaginationDto
  {
    public int Page {get; set;}
    public int PageSize {get; set;}
    public int Total {get; set;}
    public int TotalPages {get; set;}
  }
}