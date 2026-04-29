using Microsoft.AspNetCore.Mvc;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.API.DTOs.Admin.Activity;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/activities")]
    public class AdminActivitiesController : ControllerBase
    {
        private readonly IAdminActivityService _service;

        public AdminActivitiesController(IAdminActivityService service)
        {
            _service = service;
        }
        
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] AdminActivityListQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();

                var (items, total) = await _service.GetAllAsync(query, userId);

                return Ok(new
                {
                    total,
                    items
                });
            } 
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new {message = ex.Message});    
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new {message = ex.Message});
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.ToString() });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();

                var result = await _service.GetByIdAsync(id, userId);

                if(result == null) return NotFound();

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new {message = ex.Message});
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new {message = ex.Message});
            }
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
            if (string.IsNullOrWhiteSpace(claim))
            {
                return Guid.Empty;
            }
        
            return Guid.Parse(claim);
        }
        
        // PRIMENI OVO KADA TESTIRAS SA PRAVIM LOGIN/TOKEN FLOW
        // private Guid GetCurrentUserId()
        // {
        //     var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        //     if (string.IsNullOrWhiteSpace(claim))
        //     {
        //         throw new UnauthorizedAccessException("User id claim is missing.");
        //     }
        
        //     return Guid.Parse(claim);
        // }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateActivityDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();

                var created = await _service.CreateAsync(dto, userId);

                return StatusCode(201, created);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new {message = ex.Message});
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new {message = ex.Message});
            }
        }

        [HttpPut("{id}")]
        public IActionResult Update(Guid id) => Ok();

        [HttpDelete("{id}")]
        public IActionResult Delete(Guid id) => NoContent();
    }
}
