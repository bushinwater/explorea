using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/saved")]
    public class SavedItemsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpPost]
        public IActionResult Save() => StatusCode(201);

        [HttpDelete]
        public IActionResult Delete() => NoContent();
    }
}
