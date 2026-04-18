using System.Threading.Tasks;
using Explorea.API.DTOs.Home;
using Explorea.Server.Data;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/home")]
    public class HomeController : ControllerBase
    {
        private readonly IHomeService _homeService;

        public HomeController(IHomeService homeService)
        {
            _homeService = homeService;
        }
        
        [HttpGet]
        public async Task<IActionResult> GetHome([FromQuery] HomeQueryDto query)
        {
            try
            {
                var result = await _homeService.GetHomeDataAsync(query);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("recommendations")]
        public async Task<IActionResult> GetRecommendations()
        {
            var result = await _homeService.GetRecommendationsAsync();
            return Ok(result);
        }
    }
}
