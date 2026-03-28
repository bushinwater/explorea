using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class PlaceRepository : BaseRepository<Place>, IPlaceRepository
    {
        public PlaceRepository(AppDbContext db) : base(db) { }

        public async Task<Place?> GetBySlugAsync(string slug)
        {
            return await _set
                .Include(p => p.City)
                .Include(p => p.Destination)
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Include(p => p.AmenityLinks)
                    .ThenInclude(a => a.Amenity)
                .Include(p => p.WorkingDays)
                    .ThenInclude(w => w.Intervals)
                .Include(p => p.Events)
                .FirstOrDefaultAsync(p => p.Slug == slug);
        }

        public async Task<(List<Place> Items, int Total)> GetPagedAsync(
            Guid? destinationId, int? cityId, int? typeId,
            decimal? minRating, bool? isOpen, int page, int pageSize)
        {
            var query = _set
                .Include(p => p.City)
                .Include(p => p.Type)
                .Include(p => p.Images)
                .Include(p => p.WorkingDays)
                    .ThenInclude(w => w.Intervals)
                .AsQueryable();

            if (destinationId.HasValue)
                query = query.Where(p => p.DestinationId == destinationId);

            if (cityId.HasValue)
                query = query.Where(p => p.CityId == cityId);

            if (typeId.HasValue)
                query = query.Where(p => p.TypeId == typeId);

            if (minRating.HasValue)
                query = query.Where(p => p.AvgRating >= minRating);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }
    }
}