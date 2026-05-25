using Explorea.API.DTOs.Admin.Report;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminReportService
    {
        Task<ReportInsightsDto> GetInsightsAsync(Guid currentUserId);
        Task<List<AggregatePointDto>> GetAggregateAsync(string entity, string groupBy, string metric, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId, Guid? specificEntityId = null);
        Task<List<EntitySearchItemDto>> SearchEntitiesAsync(string entity, string q, Guid currentUserId);
        Task<EntityProfileDto?>         GetEntityProfileAsync(string entity, Guid entityId, Guid currentUserId);
        Task<List<DestinationsTableItemDto>> GetDestinationsTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            Guid currentUserId);
        Task<List<EntityTableRowDto>> GetEntityTableAsync(
            string entity, string? sortBy,
            string? filterSubType, string? filterRegion, decimal? filterMinRating,
            string? filterDifficulty, decimal? filterMinPrice, decimal? filterMaxPrice,
            List<string>? filterExtraFilters,
            Guid currentUserId,
            Guid? filterDestinationId = null);
        Task<List<string>> GetFilterOptionsAsync(string entity, string field, Guid currentUserId);
        Task<List<SubtypeOptionDto>> GetSubtypeOptionsAsync(string entity, Guid currentUserId);
        Task<List<ReportDataPointDto>> GetPreviewAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<(byte[] Data, string FileName)> ExportCsvAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<(byte[] Data, string FileName)> ExportPdfAsync(List<string> metrics, List<string> dimensions, DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId);
        Task<List<ReportTemplateDto>> GetTemplatesAsync(Guid currentUserId);
        Task<ReportTemplateDto> CreateTemplateAsync(CreateReportTemplateDto dto, Guid currentUserId);
        Task<bool> DeleteTemplateAsync(Guid id, Guid currentUserId);
    }
}
