using Explorea.Server.Services.Interfaces;
using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly AppDbContext _db;

        public ChatController(IChatService chatService, AppDbContext db)
        {
            _chatService = chatService;
            _db = db;
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

        [HttpGet("history")]
        [Authorize]
        public async Task<IActionResult> GetHistory()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            var history = await _db.UserChatHistories.FindAsync(userId);
            if (history == null)
                return Ok(new { messages = Array.Empty<ChatMessage>() });

            var messages = JsonSerializer.Deserialize<List<ChatMessage>>(
                history.Messages,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            ) ?? new List<ChatMessage>();

            return Ok(new { messages });
        }

        [HttpPut("history")]
        [Authorize]
        public async Task<IActionResult> SaveHistory([FromBody] SaveHistoryRequest request)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            var json = JsonSerializer.Serialize(
                request.Messages,
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
            );

            var history = await _db.UserChatHistories.FindAsync(userId);
            if (history == null)
            {
                _db.UserChatHistories.Add(new UserChatHistory
                {
                    UserId = userId.Value,
                    Messages = json,
                    UpdatedAt = DateTimeOffset.UtcNow,
                });
            }
            else
            {
                history.Messages = json;
                history.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<Guid?> GetCurrentUserIdAsync()
        {
            var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrWhiteSpace(email)) return null;
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            return user?.Id;
        }
    }

    public record ChatContext(double? Lat, double? Lng, string? FirstName);
    public record ChatRequest(List<ChatMessage>? History, string Message, ChatContext? Context);
    public record SaveHistoryRequest(List<ChatMessage> Messages);
}
