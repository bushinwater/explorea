using Explorea.API.DTOs.Admin.Stats;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminStatsService
    {
        Task<AdminStatsOverviewDto> GetOverviewAsync(Guid currentUserId);
    }
}
