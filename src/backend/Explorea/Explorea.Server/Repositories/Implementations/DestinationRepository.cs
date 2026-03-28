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
    }
}