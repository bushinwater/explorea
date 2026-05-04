using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Implementations
{
    public class AdminReportRepository : IAdminReportRepository
    {
        private readonly AppDbContext _db;

        public AdminReportRepository(AppDbContext db) => _db = db;

        // --- Insights ---

        public async Task<long> GetMonthlyTrafficAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            var query = _db.PopularityLogs.Where(l => l.CreatedAt >= cutoff);
            return await ApplyScopeToTrafficQuery(query, restrictToDestinationIds, placeOwnerUserId).LongCountAsync();
        }

        public async Task<string?> GetMostPopularEntityNameAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            if (placeOwnerUserId.HasValue)
            {
                return await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .OrderByDescending(p => p.Popularity)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync();
            }

            if (restrictToDestinationIds != null)
            {
                return await _db.Destinations.IgnoreQueryFilters()
                    .Where(d => restrictToDestinationIds.Contains(d.Id))
                    .OrderByDescending(d => d.Popularity)
                    .Select(d => d.Name)
                    .FirstOrDefaultAsync();
            }

            return await _db.Destinations.IgnoreQueryFilters()
                .OrderByDescending(d => d.Popularity)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();
        }

        public async Task<double> GetAvgRatingAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var query = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden);
            query = ApplyScopeToReviewQuery(query, restrictToDestinationIds, placeOwnerUserId);
            return await query.AverageAsync(r => (double?)r.Rating) ?? 0;
        }

        // --- Time series ---

        public async Task<Dictionary<DateOnly, long>> GetTrafficByDateAsync(
            DateOnly from, DateOnly to,
            List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

            var query = _db.PopularityLogs.Where(l => l.CreatedAt >= fromOffset && l.CreatedAt < toOffset);
            query = ApplyScopeToTrafficQuery(query, restrictToDestinationIds, placeOwnerUserId);

            var groups = await query
                .GroupBy(l => new { l.CreatedAt.Year, l.CreatedAt.Month, l.CreatedAt.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.LongCount() })
                .ToListAsync();

            return groups.ToDictionary(g => new DateOnly(g.Year, g.Month, g.Day), g => g.Count);
        }

        public async Task<Dictionary<DateOnly, long>> GetUserGrowthByDateAsync(DateOnly from, DateOnly to)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

            var groups = await _db.Users
                .Where(u => u.CreatedAt >= fromOffset && u.CreatedAt < toOffset)
                .GroupBy(u => new { u.CreatedAt.Year, u.CreatedAt.Month, u.CreatedAt.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.LongCount() })
                .ToListAsync();

            return groups.ToDictionary(g => new DateOnly(g.Year, g.Month, g.Day), g => g.Count);
        }

        public async Task<Dictionary<DateOnly, long>> GetReviewsByDateAsync(
            DateOnly from, DateOnly to,
            List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

            var query = _db.Reviews.Where(r => !r.IsDeleted && r.CreatedAt >= fromOffset && r.CreatedAt < toOffset);
            query = ApplyScopeToReviewQuery(query, restrictToDestinationIds, placeOwnerUserId);

            var groups = await query
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month, r.CreatedAt.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.LongCount() })
                .ToListAsync();

            return groups.ToDictionary(g => new DateOnly(g.Year, g.Month, g.Day), g => g.Count);
        }

        public async Task<Dictionary<DateOnly, long>> GetRequestsByDateAsync(
            DateOnly from, DateOnly to,
            List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

            var query = _db.SubmissionQueue
                .Where(q => q.SubmittedAt >= fromOffset && q.SubmittedAt < toOffset)
                .AsQueryable();

            if (restrictToDestinationIds != null)
                query = query.Where(q => restrictToDestinationIds.Contains(q.DestinationId));
            else if (placeOwnerUserId.HasValue)
                query = query.Where(q => q.SubmittedByUserId == placeOwnerUserId.Value);

            var groups = await query
                .GroupBy(q => new { q.SubmittedAt.Year, q.SubmittedAt.Month, q.SubmittedAt.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.LongCount() })
                .ToListAsync();

            return groups.ToDictionary(g => new DateOnly(g.Year, g.Month, g.Day), g => g.Count);
        }

        // --- Templates ---

        public async Task<List<ReportTemplate>> GetTemplatesAsync(Guid userId)
            => await _db.ReportTemplates
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

        public async Task<ReportTemplate?> GetTemplateByIdAsync(Guid id, Guid userId)
            => await _db.ReportTemplates.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        public async Task AddTemplateAsync(ReportTemplate template)
            => await _db.ReportTemplates.AddAsync(template);

        public void RemoveTemplate(ReportTemplate template)
            => _db.ReportTemplates.Remove(template);

        public async Task<int> SaveChangesAsync()
            => await _db.SaveChangesAsync();

        // --- Private helpers ---

        private IQueryable<PopularityLog> ApplyScopeToTrafficQuery(
            IQueryable<PopularityLog> query,
            List<Guid>? destinationIds,
            Guid? placeOwnerUserId)
        {
            if (destinationIds != null)
            {
                var placeIds    = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value))
                    .Select(p => p.Id);
                var eventIds    = _db.Events.IgnoreQueryFilters()
                    .Where(e => e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value))
                    .Select(e => e.Id);
                var activityIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                    .Select(a => a.Id);

                return query.Where(l =>
                    (l.EntityType == "destination" && destinationIds.Contains(l.EntityId)) ||
                    (l.EntityType == "place"       && placeIds.Contains(l.EntityId))       ||
                    (l.EntityType == "event"       && eventIds.Contains(l.EntityId))       ||
                    (l.EntityType == "activity"    && activityIds.Contains(l.EntityId)));
            }

            if (placeOwnerUserId.HasValue)
            {
                var placeIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .Select(p => p.Id);
                return query.Where(l => l.EntityType == "place" && placeIds.Contains(l.EntityId));
            }

            return query;
        }

        private IQueryable<Review> ApplyScopeToReviewQuery(
            IQueryable<Review> query,
            List<Guid>? destinationIds,
            Guid? placeOwnerUserId)
        {
            if (destinationIds != null)
            {
                var placeIds    = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value))
                    .Select(p => p.Id);
                var eventIds    = _db.Events.IgnoreQueryFilters()
                    .Where(e => e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value))
                    .Select(e => e.Id);
                var activityIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                    .Select(a => a.Id);

                return query.Where(r =>
                    (r.EntityType == "destination" && destinationIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && placeIds.Contains(r.EntityId))       ||
                    (r.EntityType == "event"       && eventIds.Contains(r.EntityId))       ||
                    (r.EntityType == "activity"    && activityIds.Contains(r.EntityId)));
            }

            if (placeOwnerUserId.HasValue)
            {
                var placeIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .Select(p => p.Id);
                return query.Where(r => r.EntityType == "place" && placeIds.Contains(r.EntityId));
            }

            return query;
        }
    }
}
