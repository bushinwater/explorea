using Explorea.API.DTOs.Admin;
using Explorea.API.DTOs.Admin.Place;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminPlaceService
    {
        Task<(List<AdminPlaceListDto> Items, int Total)> GetAllAsync(
            AdminPlaceListQueryDto query, Guid currentUserId);
        Task<(List<AdminPlaceListDto> Items, int Total)> GetDeletedAsync(
            AdminPlaceListQueryDto query, Guid currentUserId);
        Task<AdminPlaceStatsDto> GetStatsAsync(Guid currentUserId);
        Task<AdminPlaceDetailDto?> GetByIdAsync(Guid id, Guid currentUserId, bool venueLookup = false);
        Task<AdminPlaceDetailDto> CreateAsync(AdminCreatePlaceDto dto, Guid createdBy);
        Task<AdminPlaceDetailDto?> UpdateAsync(Guid id, AdminUpdatePlaceDto dto, Guid updatedBy);
        Task<bool> DeleteAsync(Guid id, Guid currentUserId);

        Task<EntityDependenciesDto> GetDependenciesAsync(Guid id, int page, int pageSize);

        Task<bool> DeleteCascadeAsync(Guid id, Guid currentUserId);

        Task<bool> RestoreAsync(Guid id, Guid currentUserId);
        Task<List<AdminMyPlaceDto>> GetMyPlacesAsync(Guid currentUserId);
        Task SubmitPlaceRequestAsync(SubmitPlaceRequestDto dto, Guid currentUserId);
    }
}
