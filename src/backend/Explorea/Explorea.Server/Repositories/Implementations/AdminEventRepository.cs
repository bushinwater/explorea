using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class AdminEventRepository : BaseRepository<Event>, IAdminEventRepository
    {
        public AdminEventRepository(AppDbContext db) : base(db) { }

        public async Task<(List<Event> Items, int Total)> GetAdminPagedAsync(
            string? search,
            Guid? destinationId, int? cityId, int? typeId,
            DateTimeOffset? startFrom, DateTimeOffset? startTo,
            List<Guid>? restrictToDestinationIds, List<int>? restrictToCityIds,
            int page, int pageSize)
        {
            var query = _db.Events
                .IgnoreQueryFilters()
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Destination)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();

                query = query.Where(e =>
                    e.Name.ToLower().Contains(term) ||
                    (e.Description != null && e.Description.ToLower().Contains(term)) ||
                    (e.Address != null && e.Address.ToLower().Contains(term)) ||
                    (e.City != null && e.City.Name.ToLower().Contains(term)) ||
                    (e.Destination != null && e.Destination.Name.ToLower().Contains(term)) ||
                    (e.Type != null && e.Type.Name.ToLower().Contains(term))
                );
            }

            if (destinationId.HasValue)
                query = query.Where(e => e.DestinationId == destinationId.Value);

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId.Value);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId.Value);

            if (startFrom.HasValue)
                query = query.Where(e => e.StartDatetime >= startFrom.Value);

            if (startTo.HasValue)
                query = query.Where(e => e.StartDatetime <= startTo.Value);

            if (restrictToDestinationIds != null && restrictToCityIds != null)
                query = query.Where(e =>
                    (e.DestinationId.HasValue && restrictToDestinationIds.Contains(e.DestinationId.Value)) ||
                    (e.CityId.HasValue && restrictToCityIds.Contains(e.CityId.Value)));

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.StartDatetime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<Event?> GetAdminByIdAsync(Guid id)
        {
            return await _db.Events
                .IgnoreQueryFilters()
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Destination)
                .Include(e => e.Place)
                .Include(e => e.Images)
                .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        }
    }
}
