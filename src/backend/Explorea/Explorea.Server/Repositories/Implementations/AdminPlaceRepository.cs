using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class AdminPlaceRepository : IAdminPlaceRepository
    {
        private readonly AppDbContext _db;

        public AdminPlaceRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<(List<Place> Items, int Total)> GetAdminPagedAsync(
            Guid? destinationId,
            int? cityId,
            int? typeId,
            bool? isFeatured,
            List<Guid>? restrictToDestinationIds,
            int page,
            int pageSize)
        {
            var query = _db.Places
                .Include(p => p.Images)
                .Include(p => p.Type)
                .Include(p => p.City)
                .Include(p => p.Destination)
                .AsQueryable();

            if (restrictToDestinationIds != null)
            {
                if (restrictToDestinationIds.Count == 0)
                    return (new List<Place>(), 0);

                query = query.Where(p => p.DestinationId.HasValue &&
                                         restrictToDestinationIds.Contains(p.DestinationId.Value));
            }

            if (destinationId.HasValue)
                query = query.Where(p => p.DestinationId == destinationId.Value);

            if (cityId.HasValue)
                query = query.Where(p => p.CityId == cityId.Value);

            if (typeId.HasValue)
                query = query.Where(p => p.TypeId == typeId.Value);

            if (isFeatured.HasValue)
                query = query.Where(p => p.IsFeatured == isFeatured.Value);

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(p => p.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<Place?> GetAdminByIdAsync(Guid id)
        {
            return await _db.Places
                .Include(p => p.Images.OrderBy(i => i.SortOrder))
                .Include(p => p.Type)
                .Include(p => p.City)
                .Include(p => p.Destination)
                .Include(p => p.Country)
                .Include(p => p.AmenityLinks)
                    .ThenInclude(al => al.Amenity)
                .Include(p => p.WorkingDays)
                    .ThenInclude(wd => wd.Intervals)
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task<List<Place>> GetMyPlacesAsync(Guid ownerId)
        {
            return await _db.Places
                .Include(p => p.Images)
                .Where(p => p.CreatedBy == ownerId)
                .OrderByDescending(p => p.UpdatedAt)
                .ToListAsync();
        }

        public async Task AddAsync(Place place)
        {
            await _db.Places.AddAsync(place);
        }

        public void Update(Place place)
        {
            _db.Places.Update(place);
        }

        public void RemoveImages(IEnumerable<PlaceImage> images)
        {
            _db.PlaceImages.RemoveRange(images);
        }

        public void RemoveAmenityLinks(IEnumerable<PlaceAmenityLink> links)
        {
            _db.PlaceAmenityLinks.RemoveRange(links);
        }

        public void RemoveWorkingDays(IEnumerable<PlaceWorkingDay> workingDays)
        {
            _db.PlaceWorkingDays.RemoveRange(workingDays);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}