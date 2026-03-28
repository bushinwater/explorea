using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/activities")]
    public class AdminActivitiesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpPost]
        public IActionResult Create() => StatusCode(201);

        [HttpPut("{id}")]
        public IActionResult Update(Guid id) => Ok();

        [HttpDelete("{id}")]
        public IActionResult Delete(Guid id) => NoContent();
    }
}
