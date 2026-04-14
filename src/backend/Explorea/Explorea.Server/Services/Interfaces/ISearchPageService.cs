using Explorea.API.DTOs.Search;

namespace Explorea.Server.Services.Interfaces
{
  public interface ISearchPageService
  {
    Task<SearchPageAllResponseDto> GetAllAsync(SearchPageAllQueryDto query);
    Task<SearchPageListResponseDto> GetListAsync(SearchPageListQueryDto query);
  }
}