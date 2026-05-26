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
            string? search,
            int? typeId,
            string? status,
            int? filterRegionId,
            decimal? minRating,
            Guid? destinationId,
            int? amenityId,
            Guid? restrictToOwner,
            int? restrictToRegionId,
            int page,
            int pageSize)
        {
            var query = _db.Places
                .Include(p => p.Images)
                .Include(p => p.Type)
                .Include(p => p.City)
                    .ThenInclude(c => c!.Region)
                .Include(p => p.Destination)
                .AsQueryable();

            if (restrictToOwner.HasValue)
                query = query.Where(p => p.CreatedBy == restrictToOwner.Value);
            else if (restrictToRegionId.HasValue)
                query = query.Where(p => p.City != null && p.City.RegionId == restrictToRegionId.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(p => p.Name.ToLower().Contains(s));
            }

            if (typeId.HasValue)
                query = query.Where(p => p.TypeId == typeId.Value);

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = status.Trim().ToLowerInvariant() switch
                {
                    "approved" or "active" => query.Where(p => p.ApprovalStatus == "approved"),
                    "pending"              => query.Where(p => p.ApprovalStatus == "pending"),
                    "rejected"             => query.Where(p => p.ApprovalStatus == "rejected"),
                    "inactive"             => query.Where(p => p.ApprovalStatus == "inactive"),
                    _ => query
                };
            }

            if (filterRegionId.HasValue)
                query = query.Where(p => p.City != null && p.City.RegionId == filterRegionId.Value);

            if (minRating.HasValue)
                query = query.Where(p => p.AvgRating >= minRating.Value);

            if (destinationId.HasValue)
                query = query.Where(p => p.DestinationId == destinationId.Value);

            if (amenityId.HasValue)
                query = query.Where(p => p.AmenityLinks.Any(al => al.AmenityId == amenityId.Value));

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
                .IgnoreQueryFilters()
                .Include(p => p.Images.OrderBy(i => i.SortOrder))
                .Include(p => p.Type)
                .Include(p => p.City)
                    .ThenInclude(c => c!.Region)
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

        public async Task ReplaceWorkingDaysAsync(Guid placeId, List<PlaceWorkingDay> workingDays)
        {
            var existingDays = await _db.PlaceWorkingDays
                .Include(wd => wd.Intervals)
                .Where(wd => wd.PlaceId == placeId)
                .ToListAsync();

            if (existingDays.Count > 0)
            {
                var existingIntervals = existingDays.SelectMany(wd => wd.Intervals).ToList();
                if (existingIntervals.Count > 0)
                    _db.PlaceWorkingHourIntervals.RemoveRange(existingIntervals);
                _db.PlaceWorkingDays.RemoveRange(existingDays);
            }

            if (workingDays.Count > 0)
                await _db.PlaceWorkingDays.AddRangeAsync(workingDays);
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
