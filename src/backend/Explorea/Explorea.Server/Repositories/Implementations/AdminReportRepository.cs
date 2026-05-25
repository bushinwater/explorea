using Explorea.API.DTOs.Admin.Report;
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

        // ─── Insights ────────────────────────────────────────────────────────────

        public async Task<long> GetMonthlyTrafficAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            var query  = _db.PopularityLogs.Where(l => l.CreatedAt >= cutoff);
            return await ApplyScopeToTrafficQuery(query, restrictToDestinationIds, placeOwnerUserId).LongCountAsync();
        }

        public async Task<string?> GetMostPopularEntityNameAsync(List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            if (placeOwnerUserId.HasValue)
                return await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .OrderByDescending(p => p.Popularity)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync();

            if (restrictToDestinationIds != null)
                return await _db.Destinations.IgnoreQueryFilters()
                    .Where(d => restrictToDestinationIds.Contains(d.Id))
                    .OrderByDescending(d => d.Popularity)
                    .Select(d => d.Name)
                    .FirstOrDefaultAsync();

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

        public async Task<string?> GetTopRegionAsync(List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Destinations
                .Where(d => !d.IsDeleted && d.City != null && d.City.Region != null);
            if (destIds != null) q = q.Where(d => destIds.Contains(d.Id));
            return await q
                .GroupBy(d => d.City!.Region!.Name)
                .OrderByDescending(g => g.Sum(d => (long)d.Popularity))
                .Select(g => g.Key)
                .FirstOrDefaultAsync();
        }

        public async Task<long> GetNewUsersThisMonthAsync()
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            return await _db.Users.LongCountAsync(u => u.CreatedAt >= cutoff);
        }

        public async Task<string?> GetCountryNameAsync()
            => await _db.Countries.OrderBy(c => c.Id).Select(c => c.Name).FirstOrDefaultAsync();

        public async Task<string?> GetScopeRegionAsync(List<Guid> destIds)
            => null; // kept for interface compat — not used

        public async Task<List<Guid>> GetDestinationIdsByRegionAsync(int regionId)
            => await _db.Destinations
                .Where(d => !d.IsDeleted && d.City != null && d.City.RegionId == regionId)
                .Select(d => d.Id)
                .ToListAsync();

        public async Task<string?> GetTopEntityTypeAsync()
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            var result = await _db.PopularityLogs
                .Where(l => l.CreatedAt >= cutoff)
                .GroupBy(l => l.EntityType)
                .Select(g => new { Type = g.Key, Count = g.LongCount() })
                .OrderByDescending(x => x.Count)
                .FirstOrDefaultAsync();
            return result?.Type switch
            {
                "destination" => "Destinacije",
                "activity"    => "Aktivnosti",
                "event"       => "Dogadjaji",
                "place"       => "Objekti",
                _             => result?.Type,
            };
        }

        public async Task<List<DestinationsTableItemDto>> GetDestinationsTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Destinations.Where(d => !d.IsDeleted);
            if (destIds            != null) q = q.Where(d => destIds.Contains(d.Id));
            if (placeOwnerUserId.HasValue)  q = q.Take(0);
            if (!string.IsNullOrEmpty(filterSubType))
                q = q.Where(d => d.Type != null && d.Type.Name == filterSubType);
            if (!string.IsNullOrEmpty(filterRegion))
                q = q.Where(d => d.City != null && d.City.Region != null && d.City.Region.Name == filterRegion);
            if (filterMinRating.HasValue)
                q = q.Where(d => (double)d.AvgRating >= (double)filterMinRating.Value);

            var proj = q.Select(d => new DestinationsTableItemDto
            {
                Name       = d.Name,
                City       = d.City != null ? d.City.Name : null,
                Region     = d.City != null && d.City.Region != null ? d.City.Region.Name : null,
                Type       = d.Type != null ? d.Type.Name : null,
                AvgRating  = Math.Round((double)d.AvgRating, 1),
                Popularity = (long)d.Popularity,
            });

            return sortBy switch
            {
                "region"     => await proj.OrderBy(d => d.Region).ThenBy(d => d.Name).ToListAsync(),
                "type"       => await proj.OrderBy(d => d.Type).ThenBy(d => d.Name).ToListAsync(),
                "rating"     => await proj.OrderByDescending(d => d.AvgRating).ToListAsync(),
                "popularity" => await proj.OrderByDescending(d => d.Popularity).ToListAsync(),
                _            => await proj.OrderBy(d => d.Name).ToListAsync(),
            };
        }

        public async Task<List<EntityTableRowDto>> GetEntityTableAsync(
            string entity, string? sortBy,
            string? filterSubType, string? filterRegion, decimal? filterMinRating,
            string? filterDifficulty, decimal? filterMinPrice, decimal? filterMaxPrice,
            List<string>? filterExtraFilters,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            return entity switch
            {
                "activities" => await GetActivitiesTableAsync(sortBy, filterSubType, filterRegion, filterMinRating, filterDifficulty, filterMinPrice, filterMaxPrice, destIds, placeOwnerUserId),
                "events"     => await GetEventsTableAsync(sortBy, filterSubType, filterRegion, filterMinRating, filterMinPrice, filterMaxPrice, filterExtraFilters, destIds, placeOwnerUserId),
                "places"     => await GetPlacesTableAsync(sortBy, filterSubType, filterRegion, filterMinRating, filterExtraFilters, destIds, placeOwnerUserId),
                _            => [],
            };
        }

        public async Task<List<SubtypeOptionDto>> GetSubtypeOptionsAsync(
            string entity, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            return entity switch
            {
                "places" => (await ScopePlaces(destIds, placeOwnerUserId)
                    .Where(p => p.Type != null)
                    .Select(p => new { Id = p.Type!.Id, Name = p.Type!.Name })
                    .Distinct()
                    .OrderBy(x => x.Name)
                    .ToListAsync())
                    .Select(x => new SubtypeOptionDto { Id = x.Id, Name = x.Name })
                    .ToList(),

                "events" => (await ScopeEvents(destIds, placeOwnerUserId)
                    .Where(e => e.Type != null)
                    .Select(e => new { Id = e.Type!.Id, Name = e.Type!.Name })
                    .Distinct()
                    .OrderBy(x => x.Name)
                    .ToListAsync())
                    .Select(x => new SubtypeOptionDto { Id = x.Id, Name = x.Name })
                    .ToList(),

                _ => [],
            };
        }

        public async Task<List<string>> GetFilterOptionsAsync(
            string entity, string field, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            return (entity, field) switch
            {
                ("destinations", "subType") => await _db.DestinationTypes
                    .OrderBy(t => t.Name)
                    .Select(t => t.Name)
                    .ToListAsync(),

                ("destinations", "region") => await _db.Destinations
                    .Where(d => !d.IsDeleted && d.City != null && d.City.Region != null)
                    .Select(d => d.City!.Region!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("activities", "subType") => await ScopeActivities(destIds, placeOwnerUserId)
                    .Where(a => a.Category != null)
                    .Select(a => a.Category!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("activities", "region") => await ScopeActivities(destIds, placeOwnerUserId)
                    .Where(a => a.City != null && a.City.Region != null)
                    .Select(a => a.City!.Region!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("activities", "difficulty") => await ScopeActivities(destIds, placeOwnerUserId)
                    .Where(a => !string.IsNullOrEmpty(a.DifficultyLevel))
                    .Select(a => a.DifficultyLevel!).Distinct().OrderBy(x => x).ToListAsync(),

                ("events", "subType") => await ScopeEvents(destIds, placeOwnerUserId)
                    .Where(e => e.Type != null)
                    .Select(e => e.Type!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("events", "region") => await ScopeEvents(destIds, placeOwnerUserId)
                    .Where(e => e.City != null && e.City.Region != null)
                    .Select(e => e.City!.Region!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("places", "subType") => await ScopePlaces(destIds, placeOwnerUserId)
                    .Where(p => p.Type != null)
                    .Select(p => p.Type!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                ("places", "region") => await ScopePlaces(destIds, placeOwnerUserId)
                    .Where(p => p.City != null && p.City.Region != null)
                    .Select(p => p.City!.Region!.Name).Distinct().OrderBy(x => x).ToListAsync(),

                _ => [],
            };
        }

        private async Task<List<EntityTableRowDto>> GetActivitiesTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            string? filterDifficulty, decimal? filterMinPrice, decimal? filterMaxPrice,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeActivities(destIds, placeOwnerUserId);
            if (!string.IsNullOrEmpty(filterSubType))
                q = q.Where(a => a.Category != null && a.Category.Name == filterSubType);
            if (!string.IsNullOrEmpty(filterRegion))
                q = q.Where(a => a.City != null && a.City.Region != null && a.City.Region.Name == filterRegion);
            if (filterMinRating.HasValue)
                q = q.Where(a => (double)a.AvgRating >= (double)filterMinRating.Value);
            if (!string.IsNullOrEmpty(filterDifficulty))
                q = q.Where(a => a.DifficultyLevel == filterDifficulty);
            if (filterMinPrice.HasValue) q = q.Where(a => a.Price != null && a.Price >= filterMinPrice.Value);
            if (filterMaxPrice.HasValue) q = q.Where(a => a.Price != null && a.Price <= filterMaxPrice.Value);

            var proj = q.Select(a => new EntityTableRowDto
            {
                Name       = a.Name,
                SubType    = a.Category != null ? a.Category.Name : null,
                Location   = a.Destination != null ? a.Destination.Name : null,
                Region     = a.City != null && a.City.Region != null ? a.City.Region.Name : null,
                AvgRating  = Math.Round((double)a.AvgRating, 1),
                Popularity = (long)a.Popularity,
            });
            return sortBy switch
            {
                "subType"    => await proj.OrderBy(x => x.SubType).ThenBy(x => x.Name).ToListAsync(),
                "location"   => await proj.OrderBy(x => x.Location).ThenBy(x => x.Name).ToListAsync(),
                "region"     => await proj.OrderBy(x => x.Region).ThenBy(x => x.Name).ToListAsync(),
                "rating"     => await proj.OrderByDescending(x => x.AvgRating).ToListAsync(),
                "popularity" => await proj.OrderByDescending(x => x.Popularity).ToListAsync(),
                _            => await proj.OrderBy(x => x.Name).ToListAsync(),
            };
        }

        private async Task<List<EntityTableRowDto>> GetEventsTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            decimal? filterMinPrice, decimal? filterMaxPrice, List<string>? filterExtraFilters,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeEvents(destIds, placeOwnerUserId);
            if (!string.IsNullOrEmpty(filterSubType))
                q = q.Where(e => e.Type != null && e.Type.Name == filterSubType);
            if (!string.IsNullOrEmpty(filterRegion))
                q = q.Where(e => e.City != null && e.City.Region != null && e.City.Region.Name == filterRegion);
            if (filterMinRating.HasValue)
                q = q.Where(e => (double)e.AvgRating >= (double)filterMinRating.Value);
            if (filterMinPrice.HasValue) q = q.Where(e => e.Price != null && e.Price >= filterMinPrice.Value);
            if (filterMaxPrice.HasValue) q = q.Where(e => e.Price != null && e.Price <= filterMaxPrice.Value);
            if (filterExtraFilters?.Count > 0)
            {
                var dict = ParseExtraFilters(filterExtraFilters);
                foreach (var kvp in dict)
                {
                    var snippet = $"{{\"{kvp.Key}\": {kvp.Value.ToLower()}}}";
                    q = q.Where(e => e.ExtraFilters != null && EF.Functions.JsonContains(e.ExtraFilters, snippet));
                }
            }

            var proj = q.Select(e => new EntityTableRowDto
            {
                Name       = e.Name,
                SubType    = e.Type != null ? e.Type.Name : null,
                Location   = e.Destination != null ? e.Destination.Name : null,
                Region     = e.City != null && e.City.Region != null ? e.City.Region.Name : null,
                AvgRating  = Math.Round((double)e.AvgRating, 1),
                Popularity = (long)e.Popularity,
            });
            return sortBy switch
            {
                "subType"    => await proj.OrderBy(x => x.SubType).ThenBy(x => x.Name).ToListAsync(),
                "location"   => await proj.OrderBy(x => x.Location).ThenBy(x => x.Name).ToListAsync(),
                "region"     => await proj.OrderBy(x => x.Region).ThenBy(x => x.Name).ToListAsync(),
                "rating"     => await proj.OrderByDescending(x => x.AvgRating).ToListAsync(),
                "popularity" => await proj.OrderByDescending(x => x.Popularity).ToListAsync(),
                _            => await proj.OrderBy(x => x.Name).ToListAsync(),
            };
        }

        private async Task<List<EntityTableRowDto>> GetPlacesTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            List<string>? filterExtraFilters,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopePlaces(destIds, placeOwnerUserId);
            if (!string.IsNullOrEmpty(filterSubType))
                q = q.Where(p => p.Type != null && p.Type.Name == filterSubType);
            if (!string.IsNullOrEmpty(filterRegion))
                q = q.Where(p => p.City != null && p.City.Region != null && p.City.Region.Name == filterRegion);
            if (filterMinRating.HasValue)
                q = q.Where(p => (double)p.AvgRating >= (double)filterMinRating.Value);
            if (filterExtraFilters?.Count > 0)
            {
                var dict = ParseExtraFilters(filterExtraFilters);
                foreach (var kvp in dict)
                {
                    var snippet = $"{{\"{kvp.Key}\": {kvp.Value.ToLower()}}}";
                    q = q.Where(p => p.ExtraFilters != null && EF.Functions.JsonContains(p.ExtraFilters, snippet));
                }
            }

            var proj = q.Select(p => new EntityTableRowDto
            {
                Name       = p.Name,
                SubType    = p.Type != null ? p.Type.Name : null,
                Location   = p.Destination != null ? p.Destination.Name : null,
                Region     = p.City != null && p.City.Region != null ? p.City.Region.Name : null,
                AvgRating  = Math.Round((double)p.AvgRating, 1),
                Popularity = (long)p.Popularity,
            });
            return sortBy switch
            {
                "subType"    => await proj.OrderBy(x => x.SubType).ThenBy(x => x.Name).ToListAsync(),
                "location"   => await proj.OrderBy(x => x.Location).ThenBy(x => x.Name).ToListAsync(),
                "region"     => await proj.OrderBy(x => x.Region).ThenBy(x => x.Name).ToListAsync(),
                "rating"     => await proj.OrderByDescending(x => x.AvgRating).ToListAsync(),
                "popularity" => await proj.OrderByDescending(x => x.Popularity).ToListAsync(),
                _            => await proj.OrderBy(x => x.Name).ToListAsync(),
            };
        }

        // ─── Aggregate ───────────────────────────────────────────────────────────

        public async Task<List<AggregatePointDto>> GetAggregateAsync(
            string entity, string groupBy, string metric,
            DateOnly? dateFrom, DateOnly? dateTo,
            List<Guid>? destIds, Guid? placeOwnerUserId,
            Guid? specificEntityId = null)
        {
            // When a specific destination is selected, scope to just that one
            if (specificEntityId.HasValue && entity == "destinations")
            {
                destIds          = [specificEntityId.Value];
                placeOwnerUserId = null;
            }

            DateTimeOffset? fromOff = dateFrom.HasValue
                ? new DateTimeOffset(dateFrom.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) : null;
            DateTimeOffset? toOff = dateTo.HasValue
                ? new DateTimeOffset(dateTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) : null;

            return (entity, groupBy) switch
            {
                ("destinations", "region")    => await AggDests_Region(metric, destIds),
                ("destinations", "type")      => await AggDests_Type(metric, destIds),
                ("destinations", "time")      => await AggDests_Time(metric, fromOff, toOff, destIds),

                ("activities", "category")    => await AggActivities_Category(metric, destIds, placeOwnerUserId),
                ("activities", "destination") => await AggActivities_Destination(metric, destIds, placeOwnerUserId),
                ("activities", "region")      => await AggActivities_Region(metric, destIds, placeOwnerUserId),
                ("activities", "time")        => await AggActivities_Time(metric, fromOff, toOff, destIds, placeOwnerUserId, specificEntityId),

                ("events", "type")            => await AggEvents_Type(metric, destIds, placeOwnerUserId),
                ("events", "destination")     => await AggEvents_Destination(metric, destIds, placeOwnerUserId),
                ("events", "region")          => await AggEvents_Region(metric, destIds, placeOwnerUserId),
                ("events", "time")            => await AggEvents_Time(metric, fromOff, toOff, destIds, placeOwnerUserId, specificEntityId),

                ("places", "type")            => await AggPlaces_Type(metric, destIds, placeOwnerUserId),
                ("places", "destination")     => await AggPlaces_Destination(metric, destIds, placeOwnerUserId),
                ("places", "region")          => await AggPlaces_Region(metric, destIds, placeOwnerUserId),
                ("places", "time")            => await AggPlaces_Time(metric, fromOff, toOff, destIds, placeOwnerUserId, specificEntityId),

                ("reviews", "rating")         => await AggReviews_Rating(fromOff, toOff, destIds, placeOwnerUserId),
                ("reviews", "entityType")     => await AggReviews_EntityType(fromOff, toOff, destIds, placeOwnerUserId),
                ("reviews", "time")           => await AggReviews_Time(fromOff, toOff, destIds, placeOwnerUserId),

                ("users", "time")             => await AggUsers_Time(fromOff, toOff),
                ("users", "gender")           => await AggUsers_Gender(fromOff, toOff),
                ("users", "ageGroup")         => await AggUsers_AgeGroup(fromOff, toOff),

                _ => []
            };
        }

        // ─── Destinations ────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggDests_Region(string metric, List<Guid>? destIds)
        {
            var q = _db.Destinations.Where(d => !d.IsDeleted);
            if (destIds != null) q = q.Where(d => destIds.Contains(d.Id));

            if (metric == "avgRating")
            {
                var raw = await q
                    .GroupBy(d => d.City != null && d.City.Region != null ? d.City.Region.Name : "Nepoznato")
                    .Select(g => new { Label = g.Key, Value = g.Average(d => (double)d.AvgRating) })
                    .OrderByDescending(x => x.Value).ToListAsync();
                return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
            }

            if (metric == "traffic")
            {
                var rows = await q.Select(d => new { d.Id, Region = d.City != null && d.City.Region != null ? d.City.Region.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "destination" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Region)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(d => new { Region = d.City != null && d.City.Region != null ? d.City.Region.Name : "Nepoznato" })
                .GroupBy(x => x.Region)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggDests_Type(string metric, List<Guid>? destIds)
        {
            var q = _db.Destinations.Where(d => !d.IsDeleted);
            if (destIds != null) q = q.Where(d => destIds.Contains(d.Id));

            if (metric == "avgRating")
            {
                var raw = await q
                    .GroupBy(d => d.Type != null ? d.Type.Name : "Nepoznato")
                    .Select(g => new { Label = g.Key, Value = g.Average(d => (double)d.AvgRating) })
                    .OrderByDescending(x => x.Value).ToListAsync();
                return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
            }

            if (metric == "traffic")
            {
                var rows = await q.Select(d => new { d.Id, TypeName = d.Type != null ? d.Type.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "destination" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.TypeName)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(d => new { TypeName = d.Type != null ? d.Type.Name : "Nepoznato" })
                .GroupBy(x => x.TypeName)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggDests_Time(
            string metric, DateTimeOffset? from, DateTimeOffset? to, List<Guid>? destIds)
        {
            if (metric == "traffic")
            {
                var logQ = _db.PopularityLogs.Where(l => l.EntityType == "destination");
                if (from.HasValue) logQ = logQ.Where(l => l.CreatedAt >= from.Value);
                if (to.HasValue)   logQ = logQ.Where(l => l.CreatedAt < to.Value);
                if (destIds != null) logQ = logQ.Where(l => destIds.Contains(l.EntityId));
                return await GroupByMonth(logQ.Select(l => l.CreatedAt));
            }
            if (metric == "avgRating")
            {
                var revQ = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden && r.EntityType == "destination");
                if (from.HasValue)   revQ = revQ.Where(r => r.CreatedAt >= from.Value);
                if (to.HasValue)     revQ = revQ.Where(r => r.CreatedAt < to.Value);
                if (destIds != null) revQ = revQ.Where(r => destIds.Contains(r.EntityId));
                return await GroupByMonthAvgRating(revQ);
            }
            var q = _db.Destinations.Where(d => !d.IsDeleted);
            if (destIds != null) q = q.Where(d => destIds.Contains(d.Id));
            if (from.HasValue) q = q.Where(d => d.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(d => d.CreatedAt < to.Value);
            return await GroupByMonth(q.Select(d => d.CreatedAt));
        }

        // ─── Activities ──────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggActivities_Category(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeActivities(destIds, placeOwnerUserId);

            if (metric == "avgRating")
            {
                var raw = await q
                    .GroupBy(a => a.Category != null ? a.Category.Name : "Nepoznato")
                    .Select(g => new { Label = g.Key, Value = g.Average(a => (double)a.AvgRating) })
                    .OrderByDescending(x => x.Value).ToListAsync();
                return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
            }

            if (metric == "traffic")
            {
                var rows = await q.Select(a => new { a.Id, Cat = a.Category != null ? a.Category.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "activity" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Cat)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(a => new { Cat = a.Category != null ? a.Category.Name : "Nepoznato" })
                .GroupBy(x => x.Cat)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggActivities_Destination(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeActivities(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(a => new { a.Id, Dest = a.Destination != null ? a.Destination.Name : "Bez destinacije" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "activity" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Dest)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).Take(20).ToList();
            }
            return await q
                .GroupBy(a => a.Destination != null ? a.Destination.Name : "Bez destinacije")
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggActivities_Region(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeActivities(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(a => new { a.Id, Region = a.City != null && a.City.Region != null ? a.City.Region.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "activity" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Region)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(a => new { Region = a.City != null && a.City.Region != null ? a.City.Region.Name : "Nepoznato" })
                .GroupBy(x => x.Region)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggActivities_Time(
            string metric, DateTimeOffset? from, DateTimeOffset? to,
            List<Guid>? destIds, Guid? placeOwnerUserId, Guid? specificEntityId = null)
        {
            if (metric == "traffic")
            {
                var actIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopeActivities(destIds, placeOwnerUserId).Select(a => a.Id).ToListAsync();
                var logQ = _db.PopularityLogs.Where(l => l.EntityType == "activity" && actIds.Contains(l.EntityId));
                if (from.HasValue) logQ = logQ.Where(l => l.CreatedAt >= from.Value);
                if (to.HasValue)   logQ = logQ.Where(l => l.CreatedAt < to.Value);
                return await GroupByMonth(logQ.Select(l => l.CreatedAt));
            }
            if (metric == "avgRating")
            {
                var entityIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopeActivities(destIds, placeOwnerUserId).Select(a => a.Id).ToListAsync();
                var revQ = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden && r.EntityType == "activity" && entityIds.Contains(r.EntityId));
                if (from.HasValue) revQ = revQ.Where(r => r.CreatedAt >= from.Value);
                if (to.HasValue)   revQ = revQ.Where(r => r.CreatedAt < to.Value);
                return await GroupByMonthAvgRating(revQ);
            }
            var q = specificEntityId.HasValue
                ? _db.Activities.Where(a => a.Id == specificEntityId.Value && !a.IsDeleted)
                : ScopeActivities(destIds, placeOwnerUserId);
            if (from.HasValue) q = q.Where(a => a.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(a => a.CreatedAt < to.Value);
            return await GroupByMonth(q.Select(a => a.CreatedAt));
        }

        // ─── Events ──────────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggEvents_Type(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeEvents(destIds, placeOwnerUserId);

            if (metric == "avgRating")
            {
                var raw = await q
                    .GroupBy(e => e.Type != null ? e.Type.Name : "Nepoznato")
                    .Select(g => new { Label = g.Key, Value = g.Average(e => (double)e.AvgRating) })
                    .OrderByDescending(x => x.Value).ToListAsync();
                return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
            }

            if (metric == "traffic")
            {
                var rows = await q.Select(e => new { e.Id, TypeName = e.Type != null ? e.Type.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "event" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.TypeName)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(e => new { TypeName = e.Type != null ? e.Type.Name : "Nepoznato" })
                .GroupBy(x => x.TypeName)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggEvents_Destination(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeEvents(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(e => new { e.Id, Dest = e.Destination != null ? e.Destination.Name : "Bez destinacije" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "event" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Dest)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).Take(20).ToList();
            }
            return await q
                .GroupBy(e => e.Destination != null ? e.Destination.Name : "Bez destinacije")
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggEvents_Region(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopeEvents(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(e => new { e.Id, Region = e.City != null && e.City.Region != null ? e.City.Region.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "event" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Region)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(e => new { Region = e.City != null && e.City.Region != null ? e.City.Region.Name : "Nepoznato" })
                .GroupBy(x => x.Region)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggEvents_Time(
            string metric, DateTimeOffset? from, DateTimeOffset? to,
            List<Guid>? destIds, Guid? placeOwnerUserId, Guid? specificEntityId = null)
        {
            if (metric == "traffic")
            {
                var evIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopeEvents(destIds, placeOwnerUserId).Select(e => e.Id).ToListAsync();
                var logQ = _db.PopularityLogs.Where(l => l.EntityType == "event" && evIds.Contains(l.EntityId));
                if (from.HasValue) logQ = logQ.Where(l => l.CreatedAt >= from.Value);
                if (to.HasValue)   logQ = logQ.Where(l => l.CreatedAt < to.Value);
                return await GroupByMonth(logQ.Select(l => l.CreatedAt));
            }
            if (metric == "avgRating")
            {
                var entityIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopeEvents(destIds, placeOwnerUserId).Select(e => e.Id).ToListAsync();
                var revQ = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden && r.EntityType == "event" && entityIds.Contains(r.EntityId));
                if (from.HasValue) revQ = revQ.Where(r => r.CreatedAt >= from.Value);
                if (to.HasValue)   revQ = revQ.Where(r => r.CreatedAt < to.Value);
                return await GroupByMonthAvgRating(revQ);
            }
            var q = specificEntityId.HasValue
                ? _db.Events.Where(e => e.Id == specificEntityId.Value && !e.IsDeleted)
                : ScopeEvents(destIds, placeOwnerUserId);
            if (from.HasValue) q = q.Where(e => e.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(e => e.CreatedAt < to.Value);
            return await GroupByMonth(q.Select(e => e.CreatedAt));
        }

        // ─── Places ──────────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggPlaces_Type(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopePlaces(destIds, placeOwnerUserId);

            if (metric == "avgRating")
            {
                var raw = await q
                    .GroupBy(p => p.Type != null ? p.Type.Name : "Nepoznato")
                    .Select(g => new { Label = g.Key, Value = g.Average(p => (double)p.AvgRating) })
                    .OrderByDescending(x => x.Value).ToListAsync();
                return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
            }

            if (metric == "traffic")
            {
                var rows = await q.Select(p => new { p.Id, TypeName = p.Type != null ? p.Type.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "place" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.TypeName)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(p => new { TypeName = p.Type != null ? p.Type.Name : "Nepoznato" })
                .GroupBy(x => x.TypeName)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggPlaces_Destination(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopePlaces(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(p => new { p.Id, Dest = p.Destination != null ? p.Destination.Name : "Bez destinacije" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "place" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Dest)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).Take(20).ToList();
            }
            return await q
                .GroupBy(p => p.Destination != null ? p.Destination.Name : "Bez destinacije")
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggPlaces_Region(
            string metric, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = ScopePlaces(destIds, placeOwnerUserId);
            if (metric == "traffic")
            {
                var rows = await q.Select(p => new { p.Id, Region = p.City != null && p.City.Region != null ? p.City.Region.Name : "Nepoznato" }).ToListAsync();
                var entityIds = rows.Select(r => r.Id).ToList();
                var logCounts = await _db.PopularityLogs
                    .Where(l => l.EntityType == "place" && entityIds.Contains(l.EntityId))
                    .GroupBy(l => l.EntityId)
                    .Select(g => new { EntityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.EntityId, x => x.Count);
                return rows.GroupBy(r => r.Region)
                    .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Sum(r => logCounts.GetValueOrDefault(r.Id, 0)) })
                    .OrderByDescending(x => x.Value).ToList();
            }
            return await q.Select(p => new { Region = p.City != null && p.City.Region != null ? p.City.Region.Name : "Nepoznato" })
                .GroupBy(x => x.Region)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggPlaces_Time(
            string metric, DateTimeOffset? from, DateTimeOffset? to,
            List<Guid>? destIds, Guid? placeOwnerUserId, Guid? specificEntityId = null)
        {
            if (metric == "traffic")
            {
                var placeIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopePlaces(destIds, placeOwnerUserId).Select(p => p.Id).ToListAsync();
                var logQ = _db.PopularityLogs.Where(l => l.EntityType == "place" && placeIds.Contains(l.EntityId));
                if (from.HasValue) logQ = logQ.Where(l => l.CreatedAt >= from.Value);
                if (to.HasValue)   logQ = logQ.Where(l => l.CreatedAt < to.Value);
                return await GroupByMonth(logQ.Select(l => l.CreatedAt));
            }
            if (metric == "avgRating")
            {
                var entityIds = specificEntityId.HasValue
                    ? [specificEntityId.Value]
                    : await ScopePlaces(destIds, placeOwnerUserId).Select(p => p.Id).ToListAsync();
                var revQ = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden && r.EntityType == "place" && entityIds.Contains(r.EntityId));
                if (from.HasValue) revQ = revQ.Where(r => r.CreatedAt >= from.Value);
                if (to.HasValue)   revQ = revQ.Where(r => r.CreatedAt < to.Value);
                return await GroupByMonthAvgRating(revQ);
            }
            var q = specificEntityId.HasValue
                ? _db.Places.Where(p => p.Id == specificEntityId.Value && !p.IsDeleted)
                : ScopePlaces(destIds, placeOwnerUserId);
            if (from.HasValue) q = q.Where(p => p.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(p => p.CreatedAt < to.Value);
            return await GroupByMonth(q.Select(p => p.CreatedAt));
        }

        // ─── Reviews ─────────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggReviews_Rating(
            DateTimeOffset? from, DateTimeOffset? to, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = BaseReviews(from, to, destIds, placeOwnerUserId);
            return await q
                .GroupBy(r => r.Rating.ToString())
                .Select(g => new AggregatePointDto { Label = g.Key + " ★", Value = g.Count() })
                .OrderBy(x => x.Label).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggReviews_EntityType(
            DateTimeOffset? from, DateTimeOffset? to, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = BaseReviews(from, to, destIds, placeOwnerUserId);
            return await q
                .GroupBy(r => r.EntityType)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value).ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggReviews_Time(
            DateTimeOffset? from, DateTimeOffset? to, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = BaseReviews(from, to, destIds, placeOwnerUserId);
            return await GroupByMonth(q.Select(r => r.CreatedAt));
        }

        // ─── Users ───────────────────────────────────────────────────────────────

        private async Task<List<AggregatePointDto>> AggUsers_Time(DateTimeOffset? from, DateTimeOffset? to)
        {
            var q = _db.Users.AsQueryable();
            if (from.HasValue) q = q.Where(u => u.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(u => u.CreatedAt < to.Value);
            return await GroupByMonth(q.Select(u => u.CreatedAt));
        }

        private async Task<List<AggregatePointDto>> AggUsers_Gender(DateTimeOffset? from, DateTimeOffset? to)
        {
            var q = _db.Users.AsQueryable();
            if (from.HasValue) q = q.Where(u => u.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(u => u.CreatedAt < to.Value);
            return await q
                .GroupBy(u => u.Gender ?? "Nepoznato")
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(x => x.Value)
                .ToListAsync();
        }

        private async Task<List<AggregatePointDto>> AggUsers_AgeGroup(DateTimeOffset? from, DateTimeOffset? to)
        {
            var q = _db.Users.Where(u => u.DateOfBirth.HasValue);
            if (from.HasValue) q = q.Where(u => u.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(u => u.CreatedAt < to.Value);

            var dates  = await q.Select(u => u.DateOfBirth!.Value).ToListAsync();
            var today  = DateOnly.FromDateTime(DateTime.Today);
            var order  = new[] { "< 18", "18 – 24", "25 – 34", "35 – 44", "45 – 54", "55+" };

            return dates
                .Select(dob => {
                    var age = today.Year - dob.Year;
                    if (dob.AddYears(age) > today) age--;
                    return age < 18 ? "< 18"
                         : age < 25 ? "18 – 24"
                         : age < 35 ? "25 – 34"
                         : age < 45 ? "35 – 44"
                         : age < 55 ? "45 – 54"
                         : "55+";
                })
                .GroupBy(g => g)
                .Select(g => new AggregatePointDto { Label = g.Key, Value = g.Count() })
                .OrderBy(x => Array.IndexOf(order, x.Label))
                .ToList();
        }

        // ─── Legacy time-series ──────────────────────────────────────────────────

        public async Task<Dictionary<DateOnly, long>> GetTrafficByDateAsync(
            DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var query      = _db.PopularityLogs.Where(l => l.CreatedAt >= fromOffset && l.CreatedAt < toOffset);
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
            DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var query      = _db.Reviews.Where(r => !r.IsDeleted && r.CreatedAt >= fromOffset && r.CreatedAt < toOffset);
            query = ApplyScopeToReviewQuery(query, restrictToDestinationIds, placeOwnerUserId);
            var groups = await query
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month, r.CreatedAt.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.LongCount() })
                .ToListAsync();
            return groups.ToDictionary(g => new DateOnly(g.Year, g.Month, g.Day), g => g.Count);
        }

        public async Task<Dictionary<DateOnly, long>> GetRequestsByDateAsync(
            DateOnly from, DateOnly to, List<Guid>? restrictToDestinationIds, Guid? placeOwnerUserId)
        {
            var fromOffset = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var toOffset   = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var query      = _db.SubmissionQueue
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

        // ─── Templates ───────────────────────────────────────────────────────────

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

        // ─── Scope helpers ───────────────────────────────────────────────────────

        private IQueryable<Activity> ScopeActivities(List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Activities.Where(a => !a.IsDeleted);
            if (destIds != null)           q = q.Where(a => a.DestinationId.HasValue && destIds.Contains(a.DestinationId.Value));
            if (placeOwnerUserId.HasValue) q = q.Where(a => a.CreatedBy == placeOwnerUserId.Value);
            return q;
        }

        private IQueryable<Event> ScopeEvents(List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Events.Where(e => !e.IsDeleted);
            if (destIds != null)           q = q.Where(e => e.DestinationId.HasValue && destIds.Contains(e.DestinationId.Value));
            if (placeOwnerUserId.HasValue) q = q.Where(e => e.CreatedBy == placeOwnerUserId.Value);
            return q;
        }

        private IQueryable<Place> ScopePlaces(List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Places.Where(p => !p.IsDeleted);
            if (destIds != null)           q = q.Where(p => p.DestinationId.HasValue && destIds.Contains(p.DestinationId.Value));
            if (placeOwnerUserId.HasValue) q = q.Where(p => p.CreatedBy == placeOwnerUserId.Value);
            return q;
        }

        private IQueryable<Review> BaseReviews(
            DateTimeOffset? from, DateTimeOffset? to, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var q = _db.Reviews.Where(r => !r.IsDeleted && !r.IsHidden);
            if (from.HasValue) q = q.Where(r => r.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(r => r.CreatedAt < to.Value);
            return ApplyScopeToReviewQuery(q, destIds, placeOwnerUserId);
        }

        private IQueryable<PopularityLog> ApplyScopeToTrafficQuery(
            IQueryable<PopularityLog> query, List<Guid>? destinationIds, Guid? placeOwnerUserId)
        {
            if (destinationIds != null)
            {
                var placeIds    = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value)).Select(p => p.Id);
                var eventIds    = _db.Events.IgnoreQueryFilters()
                    .Where(e => e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)).Select(e => e.Id);
                var activityIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value)).Select(a => a.Id);
                return query.Where(l =>
                    (l.EntityType == "destination" && destinationIds.Contains(l.EntityId)) ||
                    (l.EntityType == "place"       && placeIds.Contains(l.EntityId))       ||
                    (l.EntityType == "event"       && eventIds.Contains(l.EntityId))       ||
                    (l.EntityType == "activity"    && activityIds.Contains(l.EntityId)));
            }
            if (placeOwnerUserId.HasValue)
            {
                var placeIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value).Select(p => p.Id);
                return query.Where(l => l.EntityType == "place" && placeIds.Contains(l.EntityId));
            }
            return query;
        }

        private IQueryable<Review> ApplyScopeToReviewQuery(
            IQueryable<Review> query, List<Guid>? destinationIds, Guid? placeOwnerUserId)
        {
            if (destinationIds != null)
            {
                var placeIds    = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value)).Select(p => p.Id);
                var eventIds    = _db.Events.IgnoreQueryFilters()
                    .Where(e => e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)).Select(e => e.Id);
                var activityIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value)).Select(a => a.Id);
                return query.Where(r =>
                    (r.EntityType == "destination" && destinationIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && placeIds.Contains(r.EntityId))       ||
                    (r.EntityType == "event"       && eventIds.Contains(r.EntityId))       ||
                    (r.EntityType == "activity"    && activityIds.Contains(r.EntityId)));
            }
            if (placeOwnerUserId.HasValue)
            {
                var placeIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value).Select(p => p.Id);
                return query.Where(r => r.EntityType == "place" && placeIds.Contains(r.EntityId));
            }
            return query;
        }

        private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
        {
            if (raw == null || raw.Count == 0) return new Dictionary<string, string>();
            var dict = new Dictionary<string, string>();
            foreach (var entry in raw)
            {
                var idx = entry.IndexOf(':');
                if (idx > 0) dict[entry[..idx]] = entry[(idx + 1)..];
            }
            return dict;
        }

        // ─── Entity search + profile ─────────────────────────────────────────────

        public async Task<List<EntitySearchItemDto>> SearchEntitiesAsync(
            string entity, string q, List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            if (string.IsNullOrWhiteSpace(q)) return [];
            var lower = q.ToLower();

            return entity switch
            {
                "destinations" => await _db.Destinations
                    .Where(d => !d.IsDeleted)
                    .Where(d => destIds == null || destIds.Contains(d.Id))
                    .Where(d => d.Name.ToLower().Contains(lower))
                    .OrderBy(d => d.Name).Take(20)
                    .Select(d => new EntitySearchItemDto { Id = d.Id, Name = d.Name })
                    .ToListAsync(),

                "activities" => await ScopeActivities(destIds, placeOwnerUserId)
                    .Where(a => a.Name.ToLower().Contains(lower))
                    .OrderBy(a => a.Name).Take(20)
                    .Select(a => new EntitySearchItemDto { Id = a.Id, Name = a.Name })
                    .ToListAsync(),

                "events" => await ScopeEvents(destIds, placeOwnerUserId)
                    .Where(e => e.Name.ToLower().Contains(lower))
                    .OrderBy(e => e.Name).Take(20)
                    .Select(e => new EntitySearchItemDto { Id = e.Id, Name = e.Name })
                    .ToListAsync(),

                "places" => await ScopePlaces(destIds, placeOwnerUserId)
                    .Where(p => p.Name.ToLower().Contains(lower))
                    .OrderBy(p => p.Name).Take(20)
                    .Select(p => new EntitySearchItemDto { Id = p.Id, Name = p.Name })
                    .ToListAsync(),

                _ => []
            };
        }

        public async Task<EntityProfileDto?> GetEntityProfileAsync(string entity, Guid entityId)
        {
            return entity switch
            {
                "destinations" => await GetDestProfileAsync(entityId),
                "activities"   => await GetSimpleProfileAsync("activity",   entityId),
                "events"       => await GetSimpleProfileAsync("event",      entityId),
                "places"       => await GetSimpleProfileAsync("place",      entityId),
                _ => null
            };
        }

        private async Task<EntityProfileDto?> GetDestProfileAsync(Guid id)
        {
            var dest = await _db.Destinations.IgnoreQueryFilters()
                .Where(d => d.Id == id && !d.IsDeleted)
                .Select(d => new { d.Name, AvgRating = (double)d.AvgRating })
                .FirstOrDefaultAsync();
            if (dest == null) return null;

            var now         = DateTimeOffset.UtcNow;
            var last30Start = now.AddDays(-30);
            var prev30Start = now.AddDays(-60);

            var totalViews  = await _db.PopularityLogs.LongCountAsync(l => l.EntityType == "destination" && l.EntityId == id);
            var viewsLast30 = await _db.PopularityLogs.CountAsync(l => l.EntityType == "destination" && l.EntityId == id && l.CreatedAt >= last30Start);
            var viewsPrev30 = await _db.PopularityLogs.CountAsync(l => l.EntityType == "destination" && l.EntityId == id && l.CreatedAt >= prev30Start && l.CreatedAt < last30Start);
            var reviewCount = await _db.Reviews.CountAsync(r => r.EntityType == "destination" && r.EntityId == id && !r.IsDeleted && !r.IsHidden);
            var placeCount  = await _db.Places.CountAsync(p    => p.DestinationId == id && !p.IsDeleted);
            var actCount    = await _db.Activities.CountAsync(a => a.DestinationId == id && !a.IsDeleted);
            var eventCount  = await _db.Events.CountAsync(e    => e.DestinationId == id && !e.IsDeleted);

            return new EntityProfileDto
            {
                Name          = dest.Name,
                TotalViews    = totalViews,
                AvgRating     = Math.Round(dest.AvgRating, 1),
                ReviewCount   = reviewCount,
                PlaceCount    = placeCount,
                ActivityCount = actCount,
                EventCount    = eventCount,
                ViewsLast30   = viewsLast30,
                ViewsPrev30   = viewsPrev30,
            };
        }

        private async Task<EntityProfileDto?> GetSimpleProfileAsync(string entityType, Guid id)
        {
            (string Name, double AvgRating)? row = entityType switch
            {
                "activity" => await _db.Activities.IgnoreQueryFilters()
                    .Where(a => a.Id == id && !a.IsDeleted)
                    .Select(a => new ValueTuple<string, double>(a.Name, (double)a.AvgRating))
                    .FirstOrDefaultAsync(),
                "event" => await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.Id == id && !e.IsDeleted)
                    .Select(e => new ValueTuple<string, double>(e.Name, (double)e.AvgRating))
                    .FirstOrDefaultAsync(),
                "place" => await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.Id == id && !p.IsDeleted)
                    .Select(p => new ValueTuple<string, double>(p.Name, (double)p.AvgRating))
                    .FirstOrDefaultAsync(),
                _ => null
            };
            if (row == null) return null;

            var now         = DateTimeOffset.UtcNow;
            var last30Start = now.AddDays(-30);
            var prev30Start = now.AddDays(-60);

            var totalViews  = await _db.PopularityLogs.LongCountAsync(l => l.EntityType == entityType && l.EntityId == id);
            var viewsLast30 = await _db.PopularityLogs.CountAsync(l => l.EntityType == entityType && l.EntityId == id && l.CreatedAt >= last30Start);
            var viewsPrev30 = await _db.PopularityLogs.CountAsync(l => l.EntityType == entityType && l.EntityId == id && l.CreatedAt >= prev30Start && l.CreatedAt < last30Start);
            var reviewCount = await _db.Reviews.CountAsync(r => r.EntityType == entityType && r.EntityId == id && !r.IsDeleted && !r.IsHidden);

            return new EntityProfileDto
            {
                Name        = row.Value.Name,
                TotalViews  = totalViews,
                AvgRating   = Math.Round(row.Value.AvgRating, 1),
                ReviewCount = reviewCount,
                ViewsLast30 = viewsLast30,
                ViewsPrev30 = viewsPrev30,
            };
        }

        // Groups a DateTimeOffset sequence by year-month and returns ordered AggregatePoints
        private async Task<List<AggregatePointDto>> GroupByMonth(IQueryable<DateTimeOffset> dates)
            => await dates
                .GroupBy(d => new { d.Year, d.Month })
                .Select(g => new AggregatePointDto
                {
                    Label = g.Key.Year.ToString() + "-" + (g.Key.Month < 10 ? "0" : "") + g.Key.Month.ToString(),
                    Value = g.Count(),
                })
                .OrderBy(x => x.Label)
                .ToListAsync();

        // Groups reviews by year-month and averages their rating
        private async Task<List<AggregatePointDto>> GroupByMonthAvgRating(IQueryable<Review> reviews)
        {
            var raw = await reviews
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
                .Select(g => new
                {
                    Label = g.Key.Year.ToString() + "-" + (g.Key.Month < 10 ? "0" : "") + g.Key.Month.ToString(),
                    Value = g.Average(r => (double)r.Rating),
                })
                .OrderBy(x => x.Label)
                .ToListAsync();
            return raw.Select(x => new AggregatePointDto { Label = x.Label, Value = Math.Round(x.Value, 1) }).ToList();
        }
    }
}
