using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpPost]
        public IActionResult Create() => StatusCode(201);

        [HttpDelete("{id}")]
        public IActionResult Delete(Guid id) => NoContent();
    }
}
