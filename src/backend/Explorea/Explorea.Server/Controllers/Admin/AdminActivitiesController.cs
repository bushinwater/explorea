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
        public IActionResult Create() => StatusCode(201);

        [HttpPut("{id}")]
        public IActionResult Update(Guid id) => Ok();

        [HttpDelete("{id}")]
        public IActionResult Delete(Guid id) => NoContent();
    }
}
