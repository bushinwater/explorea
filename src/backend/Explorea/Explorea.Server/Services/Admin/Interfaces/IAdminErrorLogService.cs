using Explorea.API.DTOs.Admin.Stats;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminErrorLogService
    {
        void Record(HttpContext context, Exception exception);
        AdminLastServerErrorDto? GetLastError();
    }
}
