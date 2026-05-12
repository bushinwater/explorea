using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class DestinationRepository : BaseRepository<Destination>, IDestinationRepository
    {
        public DestinationRepository(AppDbContext db) : base(db) { }

        public async Task<Destination?> GetBySlugAsync(string slug)
        {
            return await _set
                .Include(d => d.City)
                .Include(d => d.Images)
                .Include(d => d.Places)
                .Include(d => d.Events)
                .Include(d => d.Activities)
                .FirstOrDefaultAsync(d => d.Slug == slug);
        }

        public async Task<(List<Destination> Items, int Total)> GetPagedAsync(
            int? cityId, int? regionId, bool? featured, int page, int pageSize)
        {
            var query = _set
                .Include(d => d.City)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(d => d.CityId == cityId);

            if (regionId.HasValue)
                query = query.Where(d => d.City != null && d.City.RegionId == regionId);

            if (featured.HasValue)
                query = query.Where(d => d.IsFeatured == featured);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<(List<Destination> Items, int Total)> GetAdminPagedAsync(
            int? cityId, string? visibility, List<Guid>? restrictToIds, int page, int pageSize)
        {
            var query = _db.Destinations
                .IgnoreQueryFilters() // admin vidi i soft-deleted
                .Include(d => d.City)
                    .ThenInclude(c => c!.Region)
                .Include(d => d.Country)
                .Include(d => d.Type)
                .Where(d => !d.IsDeleted)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(d => d.CityId == cityId.Value);

            if (!string.IsNullOrWhiteSpace(visibility))
                query = query.Where(d => d.Visibility == visibility);

            if (restrictToIds != null && restrictToIds.Count > 0)
                query = query.Where(d => restrictToIds.Contains(d.Id));

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(d => d.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<Destination?> GetAdminByIdAsync(Guid id)
        {
            return await _db.Destinations
                .IgnoreQueryFilters()
                .Include(d => d.City)
                    .ThenInclude(c => c!.Region)
                .Include(d => d.Country)
                .Include(d => d.Images)
                .Include(d => d.Type)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);
        }

        public async Task<List<int>> GetCityIdsByDestinationsAsync(List<Guid> destinationIds)
        {
            return await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => destinationIds.Contains(d.Id) && d.CityId.HasValue)
                .Select(d => d.CityId!.Value)
                .Distinct()
                .ToListAsync();
        }
    }
}
