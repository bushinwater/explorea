using Explorea.API.DTOs.Admin.Stats;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminStatsService
    {
        Task<AdminStatsOverviewDto> GetOverviewAsync(Guid currentUserId);
        Task<List<AdminTrafficPointDto>> GetTrafficAsync(Guid currentUserId, int days);
        Task<List<AdminSystemStatusItemDto>> GetSystemStatusAsync(Guid currentUserId);
        Task<int> GetPendingCountAsync(Guid currentUserId);
        Task<AdminPendingCountDto> GetPendingCountBreakdownAsync(Guid currentUserId);
    }
}
