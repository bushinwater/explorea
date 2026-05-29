using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/place-types")]
    [Authorize]
    public class AdminPlaceTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminPlaceTypesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var types = await _context.PlaceTypes
                .AsNoTracking()
                .OrderBy(t => t.Name)
                .Select(t => new { id = t.Id, name = t.Name })
                .ToListAsync();

            return Ok(types);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTypeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "Name is required." });

            var now = DateTimeOffset.UtcNow;
            var pt = new PlaceType { Name = req.Name.Trim(), CreatedAt = now, UpdatedAt = now };
            _context.PlaceTypes.Add(pt);
            await _context.SaveChangesAsync();
            return Ok(new { id = pt.Id, name = pt.Name });
        }

        public record CreateTypeRequest(string Name);
    }
}
