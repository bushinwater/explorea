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
            double lat, double lng, double radiusKm, int limit)
        {
            var userPoint = CreatePoint(lat, lng);
            var radiusMeters = radiusKm * 1000;

            return await _db.Destinations
                .AsNoTracking()
                .Include(d => d.City)
                .Where(d =>
                    !d.IsDeleted &&
                    d.Location != null &&
                    d.Location.IsWithinDistance(userPoint, radiusMeters))
                .OrderByDescending(d => d.IsFeatured)
                .ThenByDescending(d => d.AvgRating)
                .ThenBy(d => d.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Place>> GetNearbyPlacesAsync(
            double lat, double lng, double radiusKm, int limit)
        {
            var userPoint = CreatePoint(lat, lng);
            var radiusMeters = radiusKm * 1000;

            return await _db.Places
                .AsNoTracking()
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Where(p =>
                    !p.IsDeleted &&
                    p.Location != null &&
                    p.Location.IsWithinDistance(userPoint, radiusMeters))
                .OrderByDescending(p => p.IsFeatured)
                .ThenByDescending(p => p.AvgRating)
                .ThenBy(p => p.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Event>> GetNearbyEventsAsync(
            double lat, double lng, double radiusKm, int limit)
        {
            var userPoint = CreatePoint(lat, lng);
            var radiusMeters = radiusKm * 1000;
            var now = DateTimeOffset.UtcNow;

            return await _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e =>
                    !e.IsDeleted &&
                    e.EndDatetime >= now &&
                    e.Location != null &&
                    e.Location.IsWithinDistance(userPoint, radiusMeters))
                .OrderByDescending(e => e.IsFeatured)
                .ThenBy(e => e.StartDatetime)
                .ThenBy(e => e.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Activity>> GetNearbyActivitiesAsync(
            double lat, double lng, double radiusKm, int limit)
        {
            var userPoint = CreatePoint(lat, lng);
            var radiusMeters = radiusKm * 1000;

            return await _db.Activities
                .AsNoTracking()
                .Include(a => a.Category)
                .Include(a => a.Images)
                .Where(a =>
                    !a.IsDeleted &&
                    a.Location != null &&
                    a.Location.IsWithinDistance(userPoint, radiusMeters))
                .OrderByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.AvgRating)
                .ThenBy(a => a.Name)
                .Take(limit)
                .ToListAsync();
        }

        // Koordinate: X = longitude, Y = latitude (NTS konvencija)
        private Point CreatePoint(double lat, double lng) =>
            _geometryFactory.CreatePoint(new Coordinate(lng, lat));
    }
}
