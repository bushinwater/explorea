using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Query;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/search")]
    public class SearchController : ControllerBase
    {
        private readonly ISearchService _searchService;

        public SearchController(ISearchService searchService)
        {
            _searchService = searchService;
        }
        [HttpGet]
        public async Task<IActionResult> Search(
            [FromQuery] string? q,
            [FromQuery] int limit = 10,
            [FromQuery] double? userLat = null,
            [FromQuery] double? userLng = null,
            [FromQuery] double? radiusKm = null)
        {
            var result = await _searchService.SearchAsync(q, limit, userLat, userLng, radiusKm);
            return Ok(result);
        }

        [HttpGet("map")]
        public IActionResult SearchMap() => Ok();
    }
}
