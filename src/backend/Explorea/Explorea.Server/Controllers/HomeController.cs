using Explorea.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/home")]
    public class HomeController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetHome() => Ok();

        // Test konekcije sa bazom
        //[HttpGet]
        //public async Task<IActionResult> GetHome([FromServices] AppDbContext db)
        //{
        //    var count = await db.Destinations.CountAsync();
        //    return Ok(new { message = "Konekcija radi!", destinationsCount = count });
        //}
    }
}
