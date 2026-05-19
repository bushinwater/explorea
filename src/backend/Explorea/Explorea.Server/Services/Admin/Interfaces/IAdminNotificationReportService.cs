namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminNotificationReportService
    {
        Task<int> SendDueReportsAsync(DateTimeOffset now);
    }
}
