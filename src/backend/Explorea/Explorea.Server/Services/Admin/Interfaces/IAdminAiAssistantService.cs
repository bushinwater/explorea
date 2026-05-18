using Explorea.API.DTOs.Admin.Ai;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminAiAssistantService
    {
        Task<AdminAiChatResponseDto> ChatAsync(Guid currentUserId, AdminAiChatRequestDto request);
        Task<List<AdminAiInsightDto>> GetInsightsAsync(Guid currentUserId);
    }
}
