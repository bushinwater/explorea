using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/filter-definitions")]
    [Authorize]
    public class AdminFilterDefinitionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminFilterDefinitionsController(AppDbContext context)
        {
            _context = context;
        }

        public record CreateFilterDefinitionRequest(
            [Required] string EntityType,
            [Required] int TypeId,
            [Required] string FilterKey,
            [Required] string FilterLabel,
            [Required] string FilterType
        );

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFilterDefinitionRequest req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var now = DateTimeOffset.UtcNow;
            var def = new FilterDefinition
            {
                EntityType  = req.EntityType.Trim().ToLower(),
                TypeId      = req.TypeId,
                FilterKey   = req.FilterKey.Trim(),
                FilterLabel = req.FilterLabel.Trim(),
                FilterType  = req.FilterType.Trim(),
                SortOrder   = 0,
                CreatedAt   = now,
                UpdatedAt   = now,
            };

            _context.FilterDefinitions.Add(def);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                def.Id,
                def.FilterKey,
                def.FilterLabel,
                def.FilterType,
                def.SortOrder,
                Options = Array.Empty<object>()
            });
        }
    }
}
