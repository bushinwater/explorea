using Explorea.API.DTOs.Admin.Report;
using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminReportRepository
    {
        // Insights
        Task<long>    GetMonthlyTrafficAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<string?> GetMostPopularEntityNameAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<double>  GetAvgRatingAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<string?> GetTopRegionAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<long>    GetNewUsersThisMonthAsync();
        Task<string?> GetTopEntityTypeAsync();

        // Flat tables
        Task<List<DestinationsTableItemDto>> GetDestinationsTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            List<Guid>? destIds, Guid? placeOwnerUserId);
        Task<List<EntityTableRowDto>> GetEntityTableAsync(
            string entity, string? sortBy,
            string? filterSubType, string? filterRegion, decimal? filterMinRating,
            string? filterDifficulty, decimal? filterMinPrice, decimal? filterMaxPrice,
            List<string>? filterExtraFilters,
            List<Guid>? destIds, Guid? placeOwnerUserId);
        Task<List<string>> GetFilterOptionsAsync(string entity, string field, List<Guid>? destIds, Guid? placeOwnerUserId);
        Task<List<SubtypeOptionDto>> GetSubtypeOptionsAsync(string entity, List<Guid>? destIds, Guid? placeOwnerUserId);

        // Aggregate (categorical + time-series)
        Task<List<AggregatePointDto>> GetAggregateAsync(
            string entity, string groupBy, string metric,
            DateOnly? dateFrom, DateOnly? dateTo,
            List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);

        // Time series for legacy preview/export
        Task<Dictionary<DateOnly, long>> GetTrafficByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<Dictionary<DateOnly, long>> GetUserGrowthByDateAsync(DateOnly from, DateOnly to);
        Task<Dictionary<DateOnly, long>> GetReviewsByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<Dictionary<DateOnly, long>> GetRequestsByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);

        // Report templates
        Task<List<ReportTemplate>> GetTemplatesAsync(Guid userId);
        Task<ReportTemplate?>      GetTemplateByIdAsync(Guid id, Guid userId);
        Task AddTemplateAsync(ReportTemplate template);
        void RemoveTemplate(ReportTemplate template);
        Task<int> SaveChangesAsync();
    }
}
