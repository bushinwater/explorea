using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class EventRepository : BaseRepository<Event>, IEventRepository
    {
        public EventRepository(AppDbContext db) : base(db) { }

        public async Task<Event?> GetBySlugAsync(string slug)
        {
            return await _set
                .Include(e => e.City)
                .Include(e => e.Destination)
                .Include(e => e.Place)
                .Include(e => e.Type)
                .Include(e => e.Images)
                .FirstOrDefaultAsync(e => e.Slug == slug);
        }

        public async Task<(List<Event> Items, int Total)> GetPagedAsync(
            int? cityId, int? typeId, DateTimeOffset? from,
            DateTimeOffset? to, bool? free, int page, int pageSize)
        {
            var query = _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId);

            if (from.HasValue)
                query = query.Where(e => e.StartDatetime >= from);

            if (to.HasValue)
                query = query.Where(e => e.EndDatetime <= to);

            if (free.HasValue && free.Value)
                query = query.Where(e => e.Price == null || e.Price == 0);

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(e => e.StartDatetime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<List<Event>> GetByMonthAsync(int year, int month)
        {
            return await _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Images)
                .Where(e => e.StartDatetime.Year == year && 
                            e.StartDatetime.Month == month)
                .OrderBy(e => e.StartDatetime)
                .ToListAsync();
        }

        public async Task<List<Event>> GetByMonthFilteredAsync(
            int year,
            int month,
            int? cityId,
            int? typeId,
            bool? free)
        {
            var query = _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e => e.StartDatetime.Year == year && e.StartDatetime.Month == month)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId);

            if (free.HasValue && free.Value)
                query = query.Where(e => e.Price == null || e.Price == 0);

            return await query
                .OrderBy(e => e.StartDatetime)
                .ToListAsync();
        }
    }
}