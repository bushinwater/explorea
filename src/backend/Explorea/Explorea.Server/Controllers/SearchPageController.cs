using Explorea.API.DTOs.Search;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
  [ApiController]
  [Route("api/search-page")]
  public class SearchPageController : ControllerBase
  {
    private readonly ISearchPageService _searchPageService;

    public SearchPageController(ISearchPageService searchPageService)
    {
      _searchPageService = searchPageService;
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAll([FromQuery] SearchPageAllQueryDto query)
    {
      try
      {
        var result = await _searchPageService.GetAllAsync(query);
        return Ok(result);
      } 
      catch (ArgumentException ex)
      {
        return BadRequest(new {message = ex.Message});
      }
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] SearchPageListQueryDto query)
    {
      try
      {
        var result = await _searchPageService.GetListAsync(query);
        return Ok(result);
      }
      catch (ArgumentException ex)
      {
        return BadRequest(new {message = ex.Message});
      }
    }
  }
}