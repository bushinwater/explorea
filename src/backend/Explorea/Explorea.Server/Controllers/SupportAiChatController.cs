using Explorea.API.DTOs.Support;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/support/ai-chat")]
    [Authorize]
    public class SupportAiChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public SupportAiChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] SupportAiChatRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "Message is required." });

            var history = dto.History
                .Select(h => new ChatMessage(h.Role, h.Content))
                .ToList();

            var reply = await _chatService.ChatAsync(history, dto.Message);

            return Ok(new SupportAiChatResponseDto
            {
                Reply = reply,
                SessionId = dto.SessionId
            });
        }
    }
}
