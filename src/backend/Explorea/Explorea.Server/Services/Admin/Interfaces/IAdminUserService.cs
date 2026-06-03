using Explorea.API.DTOs.Admin.User;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminUserService
    {
        Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDirectoryAsync(
            AdminUserDirectoryQueryDto query,
            Guid currentUserId);

        Task<AdminUserDirectoryStatsDto> GetStatsAsync(Guid currentUserId);

        Task<List<AdminUserDirectoryRegionDto>> GetRegionsAsync(Guid currentUserId);

        Task<AdminUserDirectoryItemDto> CreateAsync(AdminCreateUserDto dto, Guid currentUserId);

        Task<AdminUserDirectoryItemDto> UpdateAsync(Guid id, AdminUpdateUserDto dto, Guid currentUserId);

        Task DeleteAsync(Guid id, Guid currentUserId);

        Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDeletedDirectoryAsync(int page, int pageSize, Guid currentUserId);

        Task RestoreAsync(Guid id, Guid currentUserId);

        Task<AdminUserDirectoryItemDto> SetStatusAsync(Guid id, AdminSetUserStatusDto dto, Guid currentUserId);
    }
}
