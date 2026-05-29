using Explorea.API.DTOs.Admin.Review;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminReviewService
    {
        Task<(List<AdminReviewListDto> Items, int Total)> GetAllAsync(
            string? entityType,
            int? subtypeId,
            int? cityId,
            int? regionId,
            short? minRating,
            short? maxRating,
            string? gender,
            int? minAge,
            int? maxAge,
            bool? isHidden,
            int page,
            int pageSize,
            Guid currentUserId,
            string? search = null,
            List<string>? extraFilters = null);

        Task<AdminReviewListDto?> GetByIdAsync(Guid id, Guid currentUserId);
        Task<bool> HideAsync(Guid id, Guid currentUserId);
        Task<bool> ApproveAsync(Guid id, Guid currentUserId);
        Task<bool> DeleteAsync(Guid id, Guid currentUserId, string? reason);
    }
}
