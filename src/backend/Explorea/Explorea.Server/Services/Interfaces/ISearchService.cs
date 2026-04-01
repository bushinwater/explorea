using Explorea.API.DTOs.Search;

namespace Explorea.Server.Services.Interfaces
{
  public interface ISearchService
  {
    Task<SearchResultDto> SearchAsync(string? query, int limit = 10);
  } 
}