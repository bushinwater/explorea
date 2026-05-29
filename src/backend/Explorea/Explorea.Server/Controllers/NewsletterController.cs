using Explorea.API.DTOs.Newsletter;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Claims;
using System.Text;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/newsletter")]
    public class NewsletterController : ControllerBase
    {
        private readonly INewsletterService _newsletterService;
        private readonly IUserRepository _userRepository;
        private readonly INewsletterRepository _newsletterRepository;

        public NewsletterController(
            INewsletterService newsletterService,
            IUserRepository userRepository,
            INewsletterRepository newsletterRepository)
        {
            _newsletterService = newsletterService;
            _userRepository = userRepository;
            _newsletterRepository = newsletterRepository;
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

        [HttpGet("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromQuery] string email)
        {
            try
            {
                await _newsletterService.UnsubscribeAsync(email);

                var safeEmail = WebUtility.HtmlEncode(email);
                return Content($@"
                    <html>
                        <body style='font-family:Arial,sans-serif;color:#1f2937;padding:32px;'>
                            <h2>Uspesno ste se odjavili</h2>
                            <p>Email adresa <strong>{safeEmail}</strong> vise nece primati Explorea newsletter.</p>
                        </body>
                    </html>", "text/html");
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

                if (!CanSendNewsletter(currentUser.Role?.Name))
                    return Forbid();

                var sentCount = await _newsletterService.SendNewsletterAsync(dto.Subject, dto.HtmlBody);
                return Ok(new { message = "Newsletter sent successfully.", sentCount });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("send-test")]
        public async Task<IActionResult> SendTest()
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();

                if (!CanSendNewsletter(currentUser.Role?.Name))
                    return Forbid();

                var sentCount = await _newsletterService.SendTestNewsletterAsync();
                return Ok(new { message = "Test newsletter sent successfully.", sentCount });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("export-emails")]
        public async Task<IActionResult> ExportEmails()
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();

                if (!CanSendNewsletter(currentUser.Role?.Name))
                    return Forbid();

                var emails = await _newsletterRepository.GetAllEmailsAsync();
                var csv = new StringBuilder();
                csv.AppendLine("email");
                foreach (var email in emails)
                    csv.AppendLine(email);

                var bytes = Encoding.UTF8.GetBytes(csv.ToString());
                return File(bytes, "text/csv", "newsletter-subscribers.csv");
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

        private static bool CanSendNewsletter(string? roleName)
            => string.Equals(roleName, RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase);
    }
}
