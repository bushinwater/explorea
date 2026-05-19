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
    }
}
