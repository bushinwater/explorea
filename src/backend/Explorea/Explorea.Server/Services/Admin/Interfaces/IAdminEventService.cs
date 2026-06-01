using Explorea.API.DTOs.Admin.Event;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminEventService
    {
        Task<(List<AdminEventListDto> Items, int Total)> GetAllAsync(
            string? search,
            Guid? destinationId, int? cityId, int? typeId,
            DateTimeOffset? startFrom, DateTimeOffset? startTo,
            List<string>? extraFilters,
            int page, int pageSize, Guid currentUserId,
            string? sortBy = null);

        Task<(List<AdminEventListDto> Items, int Total)> GetDeletedAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            int page,
            int pageSize,
            Guid currentUserId);

        Task<(List<AdminEventListDto> Items, int Total)> GetExpiredAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            int page,
            int pageSize,
            Guid currentUserId);

        Task<AdminEventStatsDto> GetStatsDtoAsync(Guid currentUserId);

        Task<AdminEventDetailDto?> GetByIdAsync(Guid id, Guid currentUserId);

        Task<AdminEventDetailDto> CreateAsync(AdminCreateEventDto dto, Guid createdBy);

        Task<AdminEventDetailDto?> UpdateAsync(Guid id, AdminUpdateEventDto dto, Guid updatedBy);

        Task<bool> DeleteAsync(Guid id, Guid currentUserId);

        Task<bool> RestoreAsync(Guid id, Guid currentUserId);
    }
}
