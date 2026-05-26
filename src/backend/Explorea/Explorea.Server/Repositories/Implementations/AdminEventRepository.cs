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
            List<string>? extraFilters,
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
                .Where(e => !e.IsDeleted && e.Visibility == "published")
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

            if (extraFilters?.Count > 0)
            {
                var efDict = ParseExtraFilters(extraFilters);
                foreach (var (key, value) in efDict)
                {
                    var snippet = $"{{\"{key}\": {value.ToLower()}}}";
                    query = query.Where(e => e.ExtraFilters != null && EF.Functions.JsonContains(e.ExtraFilters, snippet));
                }
            }

            if (restrictToDestinationIds != null && restrictToCityIds != null)
                query = ApplyAccessRestrictions(query, restrictToDestinationIds, restrictToCityIds);
                
            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.StartDatetime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<int> CountActiveAsync(
            List<Guid>? restrictToDestinationIds,
            List<int>? restrictToCityIds
        )
        {
            var query = _db.Events
                .IgnoreQueryFilters()
                .Where(e => !e.IsDeleted && e.Visibility == "published");

            query = ApplyAccessRestrictions(query, restrictToDestinationIds, restrictToCityIds);

            return await query.CountAsync();
        }
        public async Task<int> CountApprovedThisMonthAsync(
            List<Guid>? restrictToDestinationIds,
            List<int>? restrictToCityIds
        )
        {
            var now = DateTimeOffset.UtcNow;
            var monthStart = new DateTimeOffset(
                now.Year,
                now.Month,
                1,
                0,
                0,
                0,
                0,
                TimeSpan.Zero
            );

            var query = _db.Events
                .IgnoreQueryFilters()
                .Where(e => !e.IsDeleted 
                    && e.CreatedAt >= monthStart
                    && e.Visibility == "published");

            query = ApplyAccessRestrictions(query, restrictToDestinationIds, restrictToCityIds);

            return await query.CountAsync();
        }

        private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
        {
            var dict = new Dictionary<string, string>();
            if (raw == null) return dict;
            foreach (var entry in raw)
            {
                var idx = entry.IndexOf(':');
                if (idx > 0)
                    dict[entry[..idx]] = entry[(idx + 1)..];
            }
            return dict;
        }

        private static IQueryable<Event> ApplyAccessRestrictions(
            IQueryable<Event> query,
            List<Guid>? restrictToDestinationIds,
            List<int>? restrictToCityIds
        )
        {
            if(restrictToDestinationIds != null && restrictToCityIds != null)
                query = query.Where(e =>
                    (e.DestinationId.HasValue && restrictToDestinationIds.Contains(e.DestinationId.Value))
                    || (e.CityId.HasValue && restrictToCityIds.Contains(e.CityId.Value))
                );
            
            return query;
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
                .FirstOrDefaultAsync(e => e.Id == id);
        }
    }
}
