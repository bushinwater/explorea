using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/events")]
    public class AdminEventsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll() => Ok();

        [HttpPost]
        public IActionResult Create() => StatusCode(201);

        [HttpPut("{id}")]
        public IActionResult Update(Guid id) => Ok();

        [HttpPut("{id}/approve")]
        public IActionResult Approve(Guid id) => Ok();

        [HttpPut("{id}/reject")]
        public IActionResult Reject(Guid id) => Ok();

        [HttpDelete("{id}")]
        public IActionResult Delete(Guid id) => NoContent();
    }
}
