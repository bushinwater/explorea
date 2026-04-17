using Explorea.API.DTOs.Newsletter;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/newsletter")]
    public class NewsletterController : ControllerBase
    {
        private readonly INewsletterService _newsletterService;
        private readonly IUserRepository _userRepository;

        public NewsletterController(
            INewsletterService newsletterService,
            IUserRepository userRepository)
        {
            _newsletterService = newsletterService;
            _userRepository = userRepository;
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

        [Authorize]
        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] SendNewsletterDto dto)
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();

                if (!string.Equals(currentUser.Role?.Name, "admin", StringComparison.OrdinalIgnoreCase))
                    return Forbid();

                var sentCount = await _newsletterService.SendNewsletterAsync(dto.Subject, dto.HtmlBody);
                return Ok(new { message = "Newsletter sent successfully.", sentCount });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private async Task<Explorea.API.Models.User> GetCurrentUserAsync()
        {
            var email = User.FindFirstValue(ClaimTypes.Email)
                     ?? User.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email claim not found in token.");

            var user = await _userRepository.GetByEmailAsync(email.Trim().ToLowerInvariant());

            if (user == null)
                throw new Exception("Authenticated user not found.");

            return user;
        }
    }
}
