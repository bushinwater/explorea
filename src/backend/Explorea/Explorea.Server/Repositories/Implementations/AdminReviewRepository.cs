using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class AdminReviewRepository : BaseRepository<Review>, IAdminReviewRepository
    {
        public AdminReviewRepository(AppDbContext db) : base(db) { }

        public async Task<(List<Review> Items, int Total)> GetAdminPagedAsync(
            string? entityType,
            int? cityId,
            short? minRating,
            short? maxRating,
            string? gender,
            int? minAge,
            int? maxAge,
            bool? isHidden,
            List<Guid>? restrictToDestinationIds,
            List<int>? restrictToCityIds,
            Guid? placeOwnerUserId,
            int page,
            int pageSize)
        {
            var query = _db.Reviews
                .Include(r => r.User)
                .Where(r => !r.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(entityType))
                query = query.Where(r => r.EntityType == entityType);

            if (minRating.HasValue)
                query = query.Where(r => r.Rating >= minRating.Value);

            if (maxRating.HasValue)
                query = query.Where(r => r.Rating <= maxRating.Value);

            if (!string.IsNullOrWhiteSpace(gender))
                query = query.Where(r => r.User.Gender == gender);

            if (minAge.HasValue)
            {
                var maxDob = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-minAge.Value);
                query = query.Where(r => r.User.DateOfBirth.HasValue && r.User.DateOfBirth.Value <= maxDob);
            }

            if (maxAge.HasValue)
            {
                var minDob = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-maxAge.Value - 1);
                query = query.Where(r => r.User.DateOfBirth.HasValue && r.User.DateOfBirth.Value >= minDob);
            }

            if (isHidden.HasValue)
                query = query.Where(r => r.IsHidden == isHidden.Value);

            // Filter po gradu — subupiti po tipu entiteta
            if (cityId.HasValue)
            {
                var cId = cityId.Value;
                var destIds  = _db.Destinations.IgnoreQueryFilters().Where(d => d.CityId == cId).Select(d => d.Id);
                var placeIds = _db.Places.IgnoreQueryFilters().Where(p => p.CityId == cId).Select(p => p.Id);
                var eventIds = _db.Events.IgnoreQueryFilters().Where(e => e.CityId == cId).Select(e => e.Id);
                var actIds   = _db.Activities.IgnoreQueryFilters().Where(a => a.CityId == cId).Select(a => a.Id);

                query = query.Where(r =>
                    (r.EntityType == "destination" && destIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && placeIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event"       && eventIds.Contains(r.EntityId)) ||
                    (r.EntityType == "activity"    && actIds.Contains(r.EntityId)));
            }

            // Restrikcija za TouristOrganization
            if (restrictToDestinationIds != null && restrictToCityIds != null)
            {
                var destIds  = restrictToDestinationIds;
                var cityIds  = restrictToCityIds;

                var placeIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => (p.DestinationId.HasValue && destIds.Contains(p.DestinationId.Value)) ||
                                (p.CityId.HasValue && cityIds.Contains(p.CityId.Value)))
                    .Select(p => p.Id);

                var eventIds = _db.Events.IgnoreQueryFilters()
                    .Where(e => (e.DestinationId.HasValue && destIds.Contains(e.DestinationId.Value)) ||
                                (e.CityId.HasValue && cityIds.Contains(e.CityId.Value)))
                    .Select(e => e.Id);

                var actIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a => (a.DestinationId.HasValue && destIds.Contains(a.DestinationId.Value)) ||
                                (a.CityId.HasValue && cityIds.Contains(a.CityId.Value)))
                    .Select(a => a.Id);

                query = query.Where(r =>
                    (r.EntityType == "destination" && destIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && placeIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event"       && eventIds.Contains(r.EntityId)) ||
                    (r.EntityType == "activity"    && actIds.Contains(r.EntityId)));
            }

            // Restrikcija za PlaceOwner — vidi samo recenzije za svoje objekte
            if (placeOwnerUserId.HasValue)
            {
                var ownerPlaceIds = _db.Places
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .Select(p => p.Id);

                query = query.Where(r => r.EntityType == "place" && ownerPlaceIds.Contains(r.EntityId));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<Review?> GetAdminByIdAsync(Guid id)
        {
            return await _db.Reviews
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        }
    }
}
