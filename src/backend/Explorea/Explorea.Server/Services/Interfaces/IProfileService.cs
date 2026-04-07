using Explorea.API.DTOs.Review;
using Explorea.API.DTOs.User;

namespace Explorea.Server.Services.Interfaces
{
    public interface IProfileService
    {
        Task<List<SavedItemDto>> GetSavedItemsAsync(Guid userId);
        Task SaveItemAsync(Guid userId, SavedItemRequestDto dto);
        Task RemoveSavedItemAsync(Guid userId, string entityType, Guid entityId);

        Task<List<ProfileReviewDto>> GetMyReviewsAsync(Guid userId);
        Task<ProfileReviewDto> AddReviewAsync(Guid userId, CreateReviewDto dto);

        Task<UserProfileDto> GetProfileAsync(Guid userId);
        Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateUserDto dto);

        Task SendSupportAsync(Guid userId, SupportRequestDto dto);
    }
}