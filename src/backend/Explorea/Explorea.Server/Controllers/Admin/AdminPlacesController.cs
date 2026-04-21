using System.Security.Claims;
using Explorea.API.DTOs.Admin.Place;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/places")]
    [Authorize]
    public class AdminPlacesController : ControllerBase
    {
        private readonly IAdminPlaceService _placeService;
        private readonly IAdminQueueService _queueService;

        public AdminPlacesController(
            IAdminPlaceService placeService,
            IAdminQueueService queueService)
        {
            _placeService = placeService;
            _queueService = queueService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] Guid? destinationId,
            [FromQuery] int? cityId,
            [FromQuery] int? typeId,
            [FromQuery] string? visibility,
            [FromQuery] bool? isFeatured,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _placeService.GetAllAsync(
                    destinationId, cityId, typeId, visibility, isFeatured, page, pageSize, userId);

                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyPlaces()
        {
            try
            {
                var userId = GetCurrentUserId();
                var items = await _placeService.GetMyPlacesAsync(userId);
                return Ok(items);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _placeService.GetByIdAsync(id, userId);
                if (result == null) return NotFound();

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreatePlaceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _placeService.CreateAsync(dto, userId);
                return StatusCode(201, created);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPost("request")]
        public async Task<IActionResult> SubmitPlaceRequest([FromBody] SubmitPlaceRequestDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                await _placeService.SubmitPlaceRequestAsync(dto, userId);
                return StatusCode(201, new { message = "Place request submitted successfully." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdatePlaceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _placeService.UpdateAsync(id, dto, userId);
                if (updated == null) return NotFound();

                return Ok(updated);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _placeService.DeleteAsync(id, userId);
                if (!deleted) return NotFound();

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
    }
}