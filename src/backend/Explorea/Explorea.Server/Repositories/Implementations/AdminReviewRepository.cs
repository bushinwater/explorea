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
            int? subtypeId,
            int? cityId,
            int? regionId,
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

            // Filter po podtipu — kategorija aktivnosti, tip događaja, tip objekta
            if (subtypeId.HasValue)
            {
                var sid = subtypeId.Value;
                if (entityType == "activity")
                {
                    var actIds = _db.Activities.IgnoreQueryFilters()
                        .Where(a => a.CategoryId == sid).Select(a => a.Id);
                    query = query.Where(r => r.EntityType == "activity" && actIds.Contains(r.EntityId));
                }
                else if (entityType == "event")
                {
                    var evIds = _db.Events.IgnoreQueryFilters()
                        .Where(e => e.TypeId == sid).Select(e => e.Id);
                    query = query.Where(r => r.EntityType == "event" && evIds.Contains(r.EntityId));
                }
                else if (entityType == "place")
                {
                    var plIds = _db.Places.IgnoreQueryFilters()
                        .Where(p => p.TypeId.HasValue && p.TypeId.Value == sid).Select(p => p.Id);
                    query = query.Where(r => r.EntityType == "place" && plIds.Contains(r.EntityId));
                }
            }

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

            // Filter po regiji (SuperAdmin)
            if (regionId.HasValue)
            {
                var rId = regionId.Value;
                var citiesInRegion = _db.Cities.Where(c => c.RegionId == rId).Select(c => c.Id);
                var dIds = _db.Destinations.IgnoreQueryFilters().Where(d => d.CityId.HasValue && citiesInRegion.Contains(d.CityId.Value)).Select(d => d.Id);
                var pIds = _db.Places.IgnoreQueryFilters().Where(p => p.CityId.HasValue && citiesInRegion.Contains(p.CityId.Value)).Select(p => p.Id);
                var eIds = _db.Events.IgnoreQueryFilters().Where(e => e.CityId.HasValue && citiesInRegion.Contains(e.CityId.Value)).Select(e => e.Id);
                var aIds = _db.Activities.IgnoreQueryFilters().Where(a => a.CityId.HasValue && citiesInRegion.Contains(a.CityId.Value)).Select(a => a.Id);
                query = query.Where(r =>
                    (r.EntityType == "destination" && dIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && pIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event"       && eIds.Contains(r.EntityId)) ||
                    (r.EntityType == "activity"    && aIds.Contains(r.EntityId)));
            }

            // Filter po gradu (korisnik)
            if (cityId.HasValue)
            {
                var cId = cityId.Value;
                var dIds = _db.Destinations.IgnoreQueryFilters().Where(d => d.CityId == cId).Select(d => d.Id);
                var pIds = _db.Places.IgnoreQueryFilters().Where(p => p.CityId == cId).Select(p => p.Id);
                var eIds = _db.Events.IgnoreQueryFilters().Where(e => e.CityId == cId).Select(e => e.Id);
                var aIds = _db.Activities.IgnoreQueryFilters().Where(a => a.CityId == cId).Select(a => a.Id);
                query = query.Where(r =>
                    (r.EntityType == "destination" && dIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && pIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event"       && eIds.Contains(r.EntityId)) ||
                    (r.EntityType == "activity"    && aIds.Contains(r.EntityId)));
            }

            // Restrikcija za TouristOrganization
            // Radi i za destination-level i za region/city-level dodeljivanje
            if (restrictToCityIds != null || restrictToDestinationIds != null)
            {
                var destIds = restrictToDestinationIds ?? new List<Guid>();
                var cityIds = restrictToCityIds ?? new List<int>();

                // Dozvoljene destinacije: direktno dodeljene ILI u dozvoljenim gradovima
                var allowedDestIds = _db.Destinations.IgnoreQueryFilters()
                    .Where(d =>
                        (destIds.Count > 0 && destIds.Contains(d.Id)) ||
                        (cityIds.Count > 0 && d.CityId.HasValue && cityIds.Contains(d.CityId.Value)))
                    .Select(d => d.Id);

                var allowedPlaceIds = _db.Places.IgnoreQueryFilters()
                    .Where(p =>
                        (destIds.Count > 0 && p.DestinationId.HasValue && destIds.Contains(p.DestinationId.Value)) ||
                        (cityIds.Count > 0 && p.CityId.HasValue && cityIds.Contains(p.CityId.Value)))
                    .Select(p => p.Id);

                var allowedEventIds = _db.Events.IgnoreQueryFilters()
                    .Where(e =>
                        (destIds.Count > 0 && e.DestinationId.HasValue && destIds.Contains(e.DestinationId.Value)) ||
                        (cityIds.Count > 0 && e.CityId.HasValue && cityIds.Contains(e.CityId.Value)))
                    .Select(e => e.Id);

                var allowedActIds = _db.Activities.IgnoreQueryFilters()
                    .Where(a =>
                        (destIds.Count > 0 && a.DestinationId.HasValue && destIds.Contains(a.DestinationId.Value)) ||
                        (cityIds.Count > 0 && a.CityId.HasValue && cityIds.Contains(a.CityId.Value)))
                    .Select(a => a.Id);

                query = query.Where(r =>
                    (r.EntityType == "destination" && allowedDestIds.Contains(r.EntityId)) ||
                    (r.EntityType == "place"       && allowedPlaceIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event"       && allowedEventIds.Contains(r.EntityId)) ||
                    (r.EntityType == "activity"    && allowedActIds.Contains(r.EntityId)));
            }

            // Restrikcija za PlaceOwner — vidi samo recenzije za svoje objekte
            if (placeOwnerUserId.HasValue)
            {
                var ownerPlaceIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == placeOwnerUserId.Value)
                    .Select(p => p.Id);

                var ownerEventIds = _db.Events.IgnoreQueryFilters()
                    .Where(e =>
                        e.CreatedBy == placeOwnerUserId.Value ||
                        (e.PlaceId.HasValue && ownerPlaceIds.Contains(e.PlaceId.Value)))
                    .Select(e => e.Id);

                query = query.Where(r =>
                    (r.EntityType == "place" && ownerPlaceIds.Contains(r.EntityId)) ||
                    (r.EntityType == "event" && ownerEventIds.Contains(r.EntityId)));
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
