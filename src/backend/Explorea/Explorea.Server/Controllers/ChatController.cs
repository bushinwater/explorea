using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public ChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "Message is required." });

            var history = request.History ?? new List<ChatMessage>();
            var reply = await _chatService.ChatAsync(history, request.Message, request.Context);
            return Ok(new { reply });
        }
    }

    public record ChatContext(double? Lat, double? Lng, string? FirstName);
    public record ChatRequest(List<ChatMessage>? History, string Message, ChatContext? Context);
}
