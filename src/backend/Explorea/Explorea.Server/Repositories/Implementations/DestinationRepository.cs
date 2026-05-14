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
            string? search,
            int? cityId,
            string? visibility,
            int? regionId,
            int? typeId,
            decimal? minRating,
            decimal? maxRating,
            List<Guid>? restrictToIds,
            int? restrictToRegionId,
            int page,
            int pageSize)
        {
            var query = _db.Destinations
                .IgnoreQueryFilters() // admin vidi i soft-deleted
                .Include(d => d.City)
                    .ThenInclude(c => c!.Region)
                .Include(d => d.Country)
                .Include(d => d.Type)
                .Where(d => !d.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(d =>
                    d.Name.ToLower().Contains(term) ||
                    d.Slug.ToLower().Contains(term) ||
                    (d.City != null && d.City.Name.ToLower().Contains(term)) ||
                    (d.Country != null && d.Country.Name.ToLower().Contains(term)) ||
                    (d.Type != null && d.Type.Name.ToLower().Contains(term)));
            }

            if (cityId.HasValue)
                query = query.Where(d => d.CityId == cityId.Value);

            if (!string.IsNullOrWhiteSpace(visibility))
            {
                var visibilityValues = NormalizeVisibilityValues(visibility);
                query = query.Where(d => visibilityValues.Contains(d.Visibility.ToLower()));
            }

            if (regionId.HasValue)
                query = query.Where(d => d.City != null && d.City.RegionId == regionId.Value);

            if (typeId.HasValue)
                query = query.Where(d => d.TypeId == typeId.Value);

            if (minRating.HasValue)
                query = query.Where(d => d.AvgRating >= minRating.Value);

            if (maxRating.HasValue)
                query = query.Where(d => d.AvgRating <= maxRating.Value);

            if (restrictToIds != null)
                query = query.Where(d => restrictToIds.Contains(d.Id));

            if (restrictToRegionId.HasValue)
                query = query.Where(d => d.City != null && d.City.RegionId == restrictToRegionId.Value);

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

        private static string[] NormalizeVisibilityValues(string visibility)
        {
            return visibility.Trim().ToLower() switch
            {
                "active" => ["active", "published"],
                "pending" => ["pending", "draft"],
                "inactive" => ["inactive", "archived"],
                "rejected" => ["rejected"],
                var value => [value]
            };
        }
    }
}
