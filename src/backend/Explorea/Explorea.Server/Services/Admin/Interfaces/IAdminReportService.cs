using Explorea.API.DTOs.Admin.Report;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminReportService
    {
        Task<ReportInsightsDto> GetInsightsAsync(Guid currentUserId);
        Task<List<ReportDataPointDto>> GetPreviewAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<(byte[] Data, string FileName)> ExportCsvAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<(byte[] Data, string FileName)> ExportPdfAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<List<ReportTemplateDto>> GetTemplatesAsync(Guid currentUserId);
        Task<ReportTemplateDto> CreateTemplateAsync(CreateReportTemplateDto dto, Guid currentUserId);
        Task<bool> DeleteTemplateAsync(Guid id, Guid currentUserId);
    }
}
