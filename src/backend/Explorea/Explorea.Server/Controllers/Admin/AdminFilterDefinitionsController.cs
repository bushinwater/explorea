using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.RegularExpressions;

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
            [Required] string FilterLabel,
            [Required] string FilterType
        );

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var def = await _context.FilterDefinitions.FindAsync(id);
            if (def == null) return NotFound();
            _context.FilterDefinitions.Remove(def);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFilterDefinitionRequest req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var entityType = req.EntityType.Trim().ToLower();
            var baseKey    = "has_" + NormalizeToKey(req.FilterLabel);
            var filterKey  = await GetUniqueKeyAsync(entityType, req.TypeId, baseKey);

            var now = DateTimeOffset.UtcNow;
            var def = new FilterDefinition
            {
                EntityType  = entityType,
                TypeId      = req.TypeId,
                FilterKey   = filterKey,
                FilterLabel = req.FilterLabel.Trim(),
                FilterType  = req.FilterType.Trim(),
                SortOrder   = 0,
                CreatedAt   = now,
                UpdatedAt   = now,
            };

            _context.FilterDefinitions.Add(def);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return StatusCode(500, new { message = "Greška pri snimanju filtera." });
            }

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

        private static string NormalizeToKey(string label)
        {
            var normalized = label.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in normalized)
            {
                var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }
            var clean = sb.ToString().Normalize(NormalizationForm.FormC);
            clean = clean.Replace('đ', 'd').Replace('Đ', 'd')
                         .Replace('ß', 's');
            clean = Regex.Replace(clean.ToLower(), @"[^a-z0-9]+", "_").Trim('_');
            return string.IsNullOrEmpty(clean) ? "filter" : clean;
        }

        private async Task<string> GetUniqueKeyAsync(string entityType, int typeId, string baseKey)
        {
            var existingKeys = await _context.FilterDefinitions
                .Where(f => f.EntityType == entityType && f.TypeId == typeId && f.FilterKey.StartsWith(baseKey))
                .Select(f => f.FilterKey)
                .ToListAsync();

            if (!existingKeys.Contains(baseKey))
                return baseKey;

            for (var i = 1; i <= 100; i++)
            {
                var candidate = baseKey + i;
                if (!existingKeys.Contains(candidate))
                    return candidate;
            }

            return baseKey + Guid.NewGuid().ToString("N")[..6];
        }
    }
}
