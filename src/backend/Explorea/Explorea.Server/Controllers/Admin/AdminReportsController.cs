using Explorea.API.DTOs.Admin.Report;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/reports")]
    [Authorize]
    public class AdminReportsController : ControllerBase
    {
        private readonly IAdminReportService _service;

        public AdminReportsController(IAdminReportService service)
            => _service = service;

        // GET /api/admin/reports/insights
        [HttpGet("insights")]
        public async Task<IActionResult> GetInsights()
        {
            try
            {
                return Ok(await _service.GetInsightsAsync(GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/destinations-table
        [HttpGet("destinations-table")]
        public async Task<IActionResult> GetDestinationsTable(
            [FromQuery] string?  sortBy,
            [FromQuery] string?  filterSubType,
            [FromQuery] string?  filterRegion,
            [FromQuery] decimal? filterMinRating,
            [FromQuery] string?  filterStatus)
        {
            try
            {
                var data = await _service.GetDestinationsTableAsync(sortBy, filterSubType, filterRegion, filterMinRating, GetCurrentUserId(), filterStatus);
                return Ok(data);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/entity-table
        [HttpGet("entity-table")]
        public async Task<IActionResult> GetEntityTable(
            [FromQuery] string        entity,
            [FromQuery] string?       sortBy,
            [FromQuery] string?       filterSubType,
            [FromQuery] string?       filterRegion,
            [FromQuery] decimal?      filterMinRating,
            [FromQuery] string?       filterDifficulty,
            [FromQuery] decimal?      filterMinPrice,
            [FromQuery] decimal?      filterMaxPrice,
            [FromQuery] List<string>? filterExtraFilters,
            [FromQuery] Guid?         filterDestinationId,
            [FromQuery] string?       filterStatus)
        {
            try
            {
                var data = await _service.GetEntityTableAsync(
                    entity, sortBy,
                    filterSubType, filterRegion, filterMinRating,
                    filterDifficulty, filterMinPrice, filterMaxPrice,
                    filterExtraFilters,
                    GetCurrentUserId(),
                    filterDestinationId, filterStatus);
                return Ok(data);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/subtype-options?entity=places
        [HttpGet("subtype-options")]
        public async Task<IActionResult> GetSubtypeOptions([FromQuery] string entity)
        {
            try
            {
                return Ok(await _service.GetSubtypeOptionsAsync(entity, GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/filter-options?entity=activities&field=subType
        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions([FromQuery] string entity, [FromQuery] string field)
        {
            try
            {
                return Ok(await _service.GetFilterOptionsAsync(entity, field, GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/aggregate
        [HttpGet("aggregate")]
        public async Task<IActionResult> GetAggregate(
            [FromQuery] string  entity,
            [FromQuery] string  groupBy,
            [FromQuery] string  metric,
            [FromQuery] DateOnly? dateFrom,
            [FromQuery] DateOnly? dateTo,
            [FromQuery] Guid?   specificEntityId,
            [FromQuery] string? filterStatus)
        {
            try
            {
                var data = await _service.GetAggregateAsync(entity, groupBy, metric, dateFrom, dateTo, GetCurrentUserId(), specificEntityId, filterStatus);
                return Ok(data);
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
            catch (NotSupportedException ex)       { return BadRequest(new { message = ex.Message }); }
        }

        // GET /api/admin/reports/global-search?q=beo
        [HttpGet("global-search")]
        public async Task<IActionResult> GlobalSearch([FromQuery] string? q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(Array.Empty<AdminGlobalSearchResultDto>());
            try
            {
                return Ok(await _service.GlobalSearchAsync(q, GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/reports/entity-search?entity=destinations&q=beo
        [HttpGet("entity-search")]
        public async Task<IActionResult> SearchEntities([FromQuery] string entity, [FromQuery] string q)
        {
            try
            {
                return Ok(await _service.SearchEntitiesAsync(entity, q, GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/reports/entity-profile?entity=destinations&id={guid}
        [HttpGet("entity-profile")]
        public async Task<IActionResult> GetEntityProfile([FromQuery] string entity, [FromQuery] Guid id)
        {
            try
            {
                var profile = await _service.GetEntityProfileAsync(entity, id, GetCurrentUserId());
                if (profile == null) return NotFound();
                return Ok(profile);
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/reports/preview?metrics=traffic,userGrowth&dimensions=reviews,requests&dateFrom=2024-01-01&dateTo=2024-01-31
        [HttpGet("preview")]
        public async Task<IActionResult> GetPreview(
            [FromQuery] string? metrics,
            [FromQuery] string? dimensions,
            [FromQuery] DateOnly? dateFrom,
            [FromQuery] DateOnly? dateTo)
        {
            try
            {
                var metricsList    = ParseList(metrics);
                var dimensionsList = ParseList(dimensions);
                var data = await _service.GetPreviewAsync(metricsList, dimensionsList, dateFrom, dateTo, GetCurrentUserId());
                return Ok(data);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/export/csv
        [HttpGet("export/csv")]
        public async Task<IActionResult> ExportCsv(
            [FromQuery] string? metrics,
            [FromQuery] string? dimensions,
            [FromQuery] DateOnly? dateFrom,
            [FromQuery] DateOnly? dateTo)
        {
            try
            {
                var (data, fileName) = await _service.ExportCsvAsync(ParseList(metrics), ParseList(dimensions), dateFrom, dateTo, GetCurrentUserId());
                return File(data, "text/csv", fileName);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/export/pdf
        [HttpGet("export/pdf")]
        public async Task<IActionResult> ExportPdf(
            [FromQuery] string? metrics,
            [FromQuery] string? dimensions,
            [FromQuery] DateOnly? dateFrom,
            [FromQuery] DateOnly? dateTo)
        {
            try
            {
                var (data, fileName) = await _service.ExportPdfAsync(ParseList(metrics), ParseList(dimensions), dateFrom, dateTo, GetCurrentUserId());
                return File(data, "application/pdf", fileName);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/reports/templates
        [HttpGet("templates")]
        public async Task<IActionResult> GetTemplates()
        {
            try
            {
                return Ok(await _service.GetTemplatesAsync(GetCurrentUserId()));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/reports/templates
        [HttpPost("templates")]
        public async Task<IActionResult> CreateTemplate([FromBody] CreateReportTemplateDto dto)
        {
            try
            {
                var result = await _service.CreateTemplateAsync(dto, GetCurrentUserId());
                return CreatedAtAction(nameof(GetTemplates), new { }, result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // DELETE /api/admin/reports/templates/{id}
        [HttpDelete("templates/{id}")]
        public async Task<IActionResult> DeleteTemplate(Guid id)
        {
            try
            {
                var result = await _service.DeleteTemplateAsync(id, GetCurrentUserId());
                if (!result) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }

        private static List<string> ParseList(string? value)
            => value?.Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).ToList() ?? new List<string>();
    }
}
