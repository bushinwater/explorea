using Explorea.Server.Controllers;

namespace Explorea.Server.Services.Interfaces
{
    public record ChatMessage(string Role, string Content);

    public interface IChatService
    {
        Task<string> ChatAsync(List<ChatMessage> history, string userMessage, ChatContext? context = null, string? systemPromptOverride = null);
    }
}
