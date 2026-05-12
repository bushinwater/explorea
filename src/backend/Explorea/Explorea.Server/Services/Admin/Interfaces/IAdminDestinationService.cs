using Explorea.API.DTOs.Admin.Destination;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminDestinationService
    {
        Task<(List<AdminDestinationListDto> Items, int Total)> GetAllAsync(
            string? search,
            int? cityId,
            string? visibility,
            int? regionId,
            int? typeId,
            decimal? minRating,
            decimal? maxRating,
            int page,
            int pageSize,
            Guid currentUserId);

        Task<AdminDestinationListDto?> GetByIdAsync(Guid id, Guid currentUserId);

        Task<AdminDestinationListDto> CreateAsync(AdminCreateDestinationDto dto, Guid createdBy);

        Task<AdminDestinationListDto?> UpdateAsync(Guid id, AdminUpdateDestinationDto dto, Guid updatedBy);

        Task<bool> DeleteAsync(Guid id, Guid currentUserId);
    }
}
