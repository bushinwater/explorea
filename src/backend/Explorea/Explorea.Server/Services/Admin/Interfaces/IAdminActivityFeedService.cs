using Explorea.API.DTOs.Admin.Activity;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminActivityFeedService
    {
        Task<List<AdminRecentActivityDto>> GetRecentAsync(Guid currentUserId, int limit);
    }
}
