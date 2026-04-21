using Explorea.API.DTOs.Admin.Place;

namespace Explorea.Server.Services.Admin.Interfaces
{
  public interface IAdminPlaceService
  {
    Task<(List<AdminPlaceListDto> Items, int Total)> GetAllAsync(
        Guid? destinationId,
        int? cityId,
        int? typeId,
        string? visibility,
        bool? isFeatured,
        int page,
        int pageSize,
        Guid currentUserId);
    Task<AdminPlaceDetailDto?> GetByIdAsync(Guid id, Guid currentUserId);
    Task<AdminPlaceDetailDto> CreateAsync(AdminCreatePlaceDto dto, Guid createdBy);
    Task<AdminPlaceDetailDto?> UpdateAsync(Guid id, AdminUpdatePlaceDto dto, Guid updatedBy);
    Task<bool> DeleteAsync(Guid id, Guid currentUserId);
    Task<List<AdminMyPlaceDto>> GetMyPlacesAsync(Guid currentUserId);
    Task SubmitPlaceRequestAsync(SubmitPlaceRequestDto dto, Guid currentUserId);
  }
}