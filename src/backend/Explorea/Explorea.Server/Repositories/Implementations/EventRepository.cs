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
                .Include(e => e.Country)
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

            if (from.HasValue && to.HasValue)
            {
                query = query.Where(e => e.StartDatetime < to && e.EndDatetime >= from);
            }
            else
            {
                if (from.HasValue)
                    query = query.Where(e => e.EndDatetime >= from);

                if (to.HasValue)
                    query = query.Where(e => e.StartDatetime < to);
            }

            if (free.HasValue && free.Value)
                query = query.Where(e => e.Price == null || e.Price == 0);

            var total = await query.CountAsync();

            // Vraćamo sve filtrirane događaje, a sortiranje i paginacija
            // se rade u servisu kako bi sortBy radio ispravno nad celim skupom.
            var items = await query.ToListAsync();

            return (items, total);
        }

        public async Task<List<Event>> GetByMonthAsync(int year, int month)
        {
            var monthStartUtc = new DateTimeOffset(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc));
            var nextMonthStartUtc = monthStartUtc.AddMonths(1);

            return await _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e => e.StartDatetime < nextMonthStartUtc && e.EndDatetime >= monthStartUtc)
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
            var monthStartUtc = new DateTimeOffset(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc));
            var nextMonthStartUtc = monthStartUtc.AddMonths(1);

            var query = _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e => e.StartDatetime < nextMonthStartUtc && e.EndDatetime >= monthStartUtc)
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