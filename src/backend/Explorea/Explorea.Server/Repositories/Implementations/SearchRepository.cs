using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Implementations
{
    public class SearchRepository : ISearchRepository
    {
        private readonly AppDbContext _db;

        public SearchRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<(List<Destination> Destinations, List<Place> Places,
              List<Event> Events, List<Activity> Activities, int Total)>
            SearchAsync(string? q, string type, int? cityId,
                       decimal? minRating, decimal? maxPrice, int page, int pageSize)
        {
            var destinations = new List<Destination>();
            var places = new List<Place>();
            var events = new List<Event>();
            var activities = new List<Activity>();

            if (type == "all" || type == "destination")
            {
                var query = _db.Destinations.Include(d => d.City).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(d => d.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(d => d.CityId == cityId);
                if (minRating.HasValue)
                    query = query.Where(d => d.AvgRating >= minRating);
                destinations = await query.ToListAsync();
            }

            if (type == "all" || type == "place")
            {
                var query = _db.Places.Include(p => p.City).Include(p => p.Type).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(p => p.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(p => p.CityId == cityId);
                if (minRating.HasValue)
                    query = query.Where(p => p.AvgRating >= minRating);
                places = await query.ToListAsync();
            }

            if (type == "all" || type == "event")
            {
                var query = _db.Events.Include(e => e.City).Include(e => e.Type).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(e => e.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(e => e.CityId == cityId);
                if (maxPrice.HasValue)
                    query = query.Where(e => e.Price == null || e.Price <= maxPrice);
                events = await query.ToListAsync();
            }

            if (type == "all" || type == "activity")
            {
                var query = _db.Activities.Include(a => a.Category).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(a => a.Name.Contains(q));
                if (maxPrice.HasValue)
                    query = query.Where(a => a.Price == null || a.Price <= maxPrice);
                activities = await query.ToListAsync();
            }

            var total = destinations.Count + places.Count + events.Count + activities.Count;

            return (destinations, places, events, activities, total);
        }

        public async Task<(List<Place> Places, List<Event> Events, List<Activity> Activities)>
            SearchMapAsync(double lat, double lng, double radiusKm, string type)
        {
            var places = new List<Place>();
            var events = new List<Event>();
            var activities = new List<Activity>();

            var radiusMeters = radiusKm * 1000;

            if (type == "all" || type == "place")
            {
                places = await _db.Places
                    .Include(p => p.Type)
                    .Where(p => p.Latitude != 0 && p.Longitude != 0)
                    .ToListAsync();
            }

            if (type == "all" || type == "event")
            {
                events = await _db.Events
                    .Include(e => e.Type)
                    .Where(e => e.Latitude != null && e.Longitude != null)
                    .ToListAsync();
            }

            if (type == "all" || type == "activity")
            {
                activities = await _db.Activities
                    .Include(a => a.Category)
                    .Where(a => a.Latitude != null && a.Longitude != null)
                    .ToListAsync();
            }

            return (places, events, activities);
        }
    }
}