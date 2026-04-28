using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminReportRepository
    {
        // Insights
        Task<long> GetMonthlyTrafficAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<string?> GetMostPopularEntityNameAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<double> GetAvgRatingAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);

        // Time series for preview/export
        Task<Dictionary<DateOnly, long>> GetTrafficByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<Dictionary<DateOnly, long>> GetUserGrowthByDateAsync(DateOnly from, DateOnly to);
        Task<Dictionary<DateOnly, long>> GetReviewsByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);
        Task<Dictionary<DateOnly, long>> GetRequestsByDateAsync(DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId);

        // Report templates
        Task<List<ReportTemplate>> GetTemplatesAsync(Guid userId);
        Task<ReportTemplate?> GetTemplateByIdAsync(Guid id, Guid userId);
        Task AddTemplateAsync(ReportTemplate template);
        void RemoveTemplate(ReportTemplate template);
        Task<int> SaveChangesAsync();
    }
}
