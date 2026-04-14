using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;
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
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating)
        {
            var query = _db.Destinations
                .AsNoTracking()
                .Include(d => d.City)
                .Where(d => !d.IsDeleted);

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(d => d.Location != null && d.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(d => d.AvgRating >= minRating.Value);

            return await query
                .OrderByDescending(d => d.IsFeatured)
                .ThenByDescending(d => d.AvgRating)
                .ThenBy(d => d.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Place>> GetNearbyPlacesAsync(
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating, bool? openNow)
        {
            var query = _db.Places
                .AsNoTracking()
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Where(p => !p.IsDeleted);

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(p => p.Location != null && p.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            if (minRating.HasValue)
                query = query.Where(p => p.AvgRating >= minRating.Value);

            if (openNow == true)
            {
                var nowTime = TimeOnly.FromDateTime(DateTime.UtcNow);
                var today = (short)DateTime.UtcNow.DayOfWeek;

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
            double? lat, double? lng, double radiusKm, int limit)
        {
            var now = DateTimeOffset.UtcNow;

            var query = _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted && e.EndDatetime >= now);

            if (lat.HasValue && lng.HasValue)
            {
                var userPoint = CreatePoint(lat.Value, lng.Value);
                var radiusMeters = radiusKm * 1000;
                query = query.Where(e => e.Location != null && e.Location.IsWithinDistance(userPoint, radiusMeters));
            }

            return await query
                .OrderByDescending(e => e.IsFeatured)
                .ThenBy(e => e.StartDatetime)
                .ThenBy(e => e.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Activity>> GetNearbyActivitiesAsync(
            double? lat, double? lng, double radiusKm, int limit, decimal? minRating)
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
                .Where(d => !d.IsDeleted && d.Slug == slug)
                .FirstOrDefaultAsync();

        public async Task<Place?> GetPlaceBySlugAsync(string slug) =>
            await _db.Places
                .AsNoTracking()
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Where(p => !p.IsDeleted && p.Slug == slug)
                .FirstOrDefaultAsync();

        public async Task<Event?> GetEventBySlugAsync(string slug)
        {
            var now = DateTimeOffset.UtcNow;
            return await _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted && e.EndDatetime >= now && e.Slug == slug)
                .FirstOrDefaultAsync();
        }

        public async Task<Activity?> GetActivityBySlugAsync(string slug) =>
            await _db.Activities
                .AsNoTracking()
                .Include(a => a.Category)
                .Include(a => a.Images)
                .Where(a => !a.IsDeleted && a.Slug == slug)
                .FirstOrDefaultAsync();

        // Koordinate: X = longitude, Y = latitude (NTS konvencija)
        private Point CreatePoint(double lat, double lng) =>
            _geometryFactory.CreatePoint(new Coordinate(lng, lat));
    }
}
