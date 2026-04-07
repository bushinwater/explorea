using Explorea.API.DTOs.User;

namespace Explorea.Server.Services.Interfaces
{
    public interface IProfileService
    {
        Task<List<SavedItemDto>> GetSavedItemsAsync(Guid userId);
        Task SaveItemAsync(Guid userId, SavedItemRequestDto dto);
        Task RemoveSavedItemAsync(Guid userId, string entityType, Guid entityId);
    }
}