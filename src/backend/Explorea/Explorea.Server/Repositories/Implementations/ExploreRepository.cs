using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;
using Npgsql;
using NpgsqlTypes;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Implementations
{
    public class ExploreRepository : IExploreRepository
    {
        private readonly AppDbContext _db;
        private readonly GeometryFactory _geometryFactory =
            NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);

        public ExploreRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<Destination>> GetNearbyDestinationsAsync(
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating,
            List<int>? destinationTypeIds = null, List<string>? extraFilters = null, int? regionId = null, bool includeAll = false)
        {
            var query = _db.Destinations
                .AsNoTracking()
                .Include(d => d.City)
                // Tourist app surfaces everything that isn't a draft/rejected admin state.
                // The click-based "Aktivno / Neaktivno" pill is purely informational in the
                // admin UI — it does NOT gate availability in the tourist app.
                .Where(d => !d.IsDeleted && (includeAll || (d.Visibility != "draft" && d.Visibility != "rejected")));

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(d => d.Location != null && d.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(d => d.AvgRating >= minRating.Value);

            if (destinationTypeIds?.Count > 0)
                query = query.Where(d => d.TypeId != null && destinationTypeIds.Contains(d.TypeId.Value));

            if (regionId.HasValue)
                query = query.Where(d =>
                    (d.RegionId != null && d.RegionId == regionId.Value)
                    || (d.RegionId == null && d.City != null && d.City.RegionId == regionId.Value));

            var extraFiltersDict = ParseExtraFilters(extraFilters);
            foreach (var (key, value) in extraFiltersDict)
            {
                var matchingIds = await MatchJsonbContainsIdsAsync("destinations", key, value);
                query = query.Where(d => matchingIds.Contains(d.Id));
            }

            return await query
                .OrderByDescending(d => d.IsFeatured)
                .ThenByDescending(d => d.AvgRating)
                .ThenBy(d => d.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Place>> GetNearbyPlacesAsync(
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating, bool? openNow,
            List<int>? placeTypeIds = null, decimal? minPrice = null, decimal? maxPrice = null,
            List<string>? extraFilters = null, int? regionId = null, bool includeAll = false)
        {
            var query = _db.Places
                .AsNoTracking()
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Where(p => !p.IsDeleted && (includeAll || p.ApprovalStatus == "approved"));

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(p => p.Location != null && p.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(p => p.AvgRating >= minRating.Value);

            if (placeTypeIds?.Count > 0)
                query = query.Where(p => p.TypeId != null && placeTypeIds.Contains(p.TypeId.Value));

            if (regionId.HasValue)
                query = query.Where(p => p.City != null && p.City.RegionId == regionId.Value);

            var extraFiltersDict = ParseExtraFilters(extraFilters);
            foreach (var (key, value) in extraFiltersDict)
            {
                var matchingIds = await MatchJsonbContainsIdsAsync("places", key, value);
                query = query.Where(p => matchingIds.Contains(p.Id));
            }

            if (openNow == true)
            {
                var nowTime = TimeOnly.FromDateTime(DateTime.UtcNow);
                // DB stores day_of_week with the ISO 8601 convention (Mon=1 … Sun=7),
                // which is enforced by a CHECK constraint. C#'s DayOfWeek enum has
                // Sunday=0, so map Sunday → 7 explicitly; without this, the OpenNow
                // filter would never match places on Sundays.
                var dow = DateTime.UtcNow.DayOfWeek;
                var today = (short)(dow == DayOfWeek.Sunday ? 7 : (int)dow);

                query = query
                    .Include(p => p.WorkingDays)
                        .ThenInclude(wd => wd.Intervals)
                    .Where(p => p.WorkingDays.Any(wd =>
                        wd.DayOfWeek == today &&
                        !wd.IsClosed &&
                        wd.Intervals.Any(i => i.OpensAt <= nowTime && i.ClosesAt >= nowTime)));
            }

            return await query
                .OrderByDescending(p => p.IsFeatured)
                .ThenByDescending(p => p.AvgRating)
                .ThenBy(p => p.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Event>> GetNearbyEventsAsync(
            double? lat, double? lng, double radiusKm, int limit,
            decimal? minRating = null, List<int>? eventTypeIds = null, decimal? minPrice = null, decimal? maxPrice = null,
            List<string>? extraFilters = null, int? regionId = null, bool includeAll = false)
        {
            var now = DateTimeOffset.UtcNow;

            var query = _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted && (includeAll || (e.Visibility != "draft" && e.Visibility != "rejected" && e.EndDatetime >= now)));

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(e => e.Location != null && e.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(e => e.AvgRating >= minRating.Value);

            if (eventTypeIds?.Count > 0)
                query = query.Where(e => eventTypeIds.Contains(e.TypeId));

            if (minPrice.HasValue)
                query = query.Where(e => e.Price == null || e.Price >= minPrice.Value);

            if (maxPrice.HasValue)
                query = query.Where(e => e.Price == null || e.Price <= maxPrice.Value);

            if (regionId.HasValue)
                query = query.Where(e => e.City != null && e.City.RegionId == regionId.Value);

            var extraFiltersDict = ParseExtraFilters(extraFilters);
            foreach (var (key, value) in extraFiltersDict)
            {
                var matchingIds = await MatchJsonbContainsIdsAsync("events", key, value);
                query = query.Where(e => matchingIds.Contains(e.Id));
            }

            return await query
                .OrderByDescending(e => e.IsFeatured)
                .ThenBy(e => e.StartDatetime)
                .ThenBy(e => e.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Activity>> GetNearbyActivitiesAsync(
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating,
            List<int>? activityCategoryIds = null, int? regionId = null, bool includeAll = false)
        {
            var query = _db.Activities
                .AsNoTracking()
                .Include(a => a.Category)
                .Include(a => a.Images)
                .Where(a => !a.IsDeleted);

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(a => a.Location != null && a.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(a => a.AvgRating >= minRating.Value);

            if (activityCategoryIds?.Count > 0)
                query = query.Where(a => activityCategoryIds.Contains(a.CategoryId));

            if (regionId.HasValue)
                query = query.Where(a => a.City != null && a.City.RegionId == regionId.Value);

            return await query
                .OrderByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.AvgRating)
                .ThenBy(a => a.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<Destination?> GetDestinationBySlugAsync(string slug) =>
            await _db.Destinations
                .AsNoTracking()
                .Include(d => d.City)
                // Mirror GetNearby* — "inactive" rows are still valid pins to click into.
                .Where(d => !d.IsDeleted && d.Visibility != "draft" && d.Visibility != "rejected" && d.Slug == slug)
                .FirstOrDefaultAsync();

        public async Task<Place?> GetPlaceBySlugAsync(string slug) =>
            await _db.Places
                .AsNoTracking()
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved" && p.Slug == slug)
                .FirstOrDefaultAsync();

        public async Task<Event?> GetEventBySlugAsync(string slug)
        {
            var now = DateTimeOffset.UtcNow;
            return await _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted && e.Visibility != "draft" && e.Visibility != "rejected" && e.EndDatetime >= now && e.Slug == slug)
                .FirstOrDefaultAsync();
        }

        public async Task<Activity?> GetActivityBySlugAsync(string slug) =>
            await _db.Activities
                .AsNoTracking()
                .Include(a => a.Category)
                .Include(a => a.Images)
                .Where(a => !a.IsDeleted && a.Slug == slug)
                .FirstOrDefaultAsync();

        // Admin stores Dictionary<string,string>, so JSONB values are always JSON strings (e.g. "true").
        // Older rows may have raw JSON values (true / 1 / etc.), so we match either representation.
        private async Task<List<Guid>> MatchJsonbContainsIdsAsync(string table, string key, string value)
        {
            var asJsonString = $"{{\"{key}\": {System.Text.Json.JsonSerializer.Serialize(value)}}}";
            var lowered = value.ToLowerInvariant();
            var asRaw = lowered is "true" or "false"
                ? $"{{\"{key}\": {lowered}}}"
                : null;

            if (asRaw == null)
            {
                var p = new NpgsqlParameter { ParameterName = "snippet", Value = asJsonString, NpgsqlDbType = NpgsqlDbType.Jsonb };
                return await _db.Database.SqlQueryRaw<Guid>(
                    $"SELECT id FROM {table} WHERE extra_filters @> @snippet", p).ToListAsync();
            }

            var p1 = new NpgsqlParameter { ParameterName = "snippetStr", Value = asJsonString, NpgsqlDbType = NpgsqlDbType.Jsonb };
            var p2 = new NpgsqlParameter { ParameterName = "snippetRaw", Value = asRaw, NpgsqlDbType = NpgsqlDbType.Jsonb };
            return await _db.Database.SqlQueryRaw<Guid>(
                $"SELECT id FROM {table} WHERE extra_filters @> @snippetStr OR extra_filters @> @snippetRaw", p1, p2).ToListAsync();
        }

        private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
        {
            if (raw == null || raw.Count == 0) return new Dictionary<string, string>();
            var dict = new Dictionary<string, string>();
            foreach (var entry in raw)
            {
                var idx = entry.IndexOf(':');
                if (idx > 0)
                    dict[entry[..idx]] = entry[(idx + 1)..];
            }
            return dict;
        }

        // Koordinate: X = longitude, Y = latitude (NTS konvencija)
        private Point CreatePoint(double lat, double lng) =>
            _geometryFactory.CreatePoint(new Coordinate(lng, lat));
    }
}
