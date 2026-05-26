using Explorea.API.DTOs.Admin.Activity;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminActivityService
    {
        Task<(List<AdminActivityListDto> Items, int Total)> GetAllAsync(
            AdminActivityListQueryDto query,
            Guid currentUserId);

        Task<(List<AdminActivityListDto> Items, int Total)> GetDeletedAsync(
            AdminActivityListQueryDto query,
            Guid currentUserId);

        Task<AdminActivityDetailsDto?> GetByIdAsync(
            Guid id,
            Guid currentUserId);

        Task<AdminActivityStatsDto> GetStatsAsync(Guid currentUserId);

        Task<AdminActivityDetailsDto> CreateAsync(
            AdminCreateActivityDto dto,
            Guid createdBy);

        Task<AdminActivityDetailsDto?> UpdateAsync(
            Guid id,
            AdminUpdateActivityDto dto,
            Guid updatedBy);

        Task<bool> DeleteAsync(
            Guid id,
            Guid currentUserId);

        Task<AdminActivityFilterOptionsDto> GetFilterOptionsAsync(Guid currentUserId);
    }
}