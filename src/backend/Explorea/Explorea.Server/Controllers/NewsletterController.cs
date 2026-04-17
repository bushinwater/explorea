using Explorea.API.DTOs.Newsletter;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/newsletter")]
    public class NewsletterController : ControllerBase
    {
        private readonly INewsletterService _newsletterService;

        public NewsletterController(INewsletterService newsletterService)
        {
            _newsletterService = newsletterService;
        }

        [HttpPost("subscribe")]
        public async Task<IActionResult> Subscribe([FromBody] SubscribeNewsletterDto dto)
        {
            try
            {
                var result = await _newsletterService.SubscribeGuestAsync(dto.Email);

                if (!result.Created)
                    return Ok(new { message = "Email is already subscribed to the newsletter.", email = result.Email });

                return StatusCode(201, new { message = "Newsletter subscription created successfully.", email = result.Email });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
