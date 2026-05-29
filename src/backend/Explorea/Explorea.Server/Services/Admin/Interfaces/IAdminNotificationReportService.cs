namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminNotificationReportService
    {
        Task<int> SendDueReportsAsync(DateTimeOffset now);
        Task<int> ForceSendReportAsync(Guid userId, DateTimeOffset now);
    }
}
