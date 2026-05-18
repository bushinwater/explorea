using Explorea.API.Models;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminActivityLogService
    {
        Task LogAsync(string type, string description, Guid? actorId = null);
        Task<List<AdminActivityLog>> GetRecentAsync(int limit);
    }
}
