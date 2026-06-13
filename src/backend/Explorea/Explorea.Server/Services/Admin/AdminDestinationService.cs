using System.Text.Json;
using Explorea.API.DTOs.Admin;
using Explorea.API.DTOs.Admin.Destination;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
    public class AdminDestinationService : IAdminDestinationService
    {
        private readonly IDestinationRepository _destinationRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISearchRepository _searchRepo;
        private readonly ICloudinaryService _cloudinary;
        private readonly AppDbContext _db;
        private readonly ISavedItemCleanupService _savedItemCleanup;
        private readonly IEmailService _emailService;

        private static readonly GeometryFactory _geometryFactory =
            new GeometryFactory(new PrecisionModel(), 4326);

        public AdminDestinationService(
            IDestinationRepository destinationRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IUserRepository userRepo,
            ISearchRepository searchRepo,
            ICloudinaryService cloudinary,
            AppDbContext db,
            ISavedItemCleanupService savedItemCleanup,
            IEmailService emailService)
        {
            _destinationRepo = destinationRepo;
            _assignmentRepo  = assignmentRepo;
            _userRepo        = userRepo;
            _searchRepo      = searchRepo;
            _cloudinary      = cloudinary;
            _db              = db;
            _savedItemCleanup = savedItemCleanup;
            _emailService    = emailService;
        }

        public async Task<(List<AdminDestinationListDto> Items, int Total)> GetAllAsync(
            string? search,
            int? cityId,
            string? visibility,
            int? regionId,
            int? typeId,
            decimal? minRating,
            decimal? maxRating,
            bool? isFeatured,
            int page,
            int pageSize,
            Guid currentUserId,
            List<string>? extraFilters = null,
            string? sortBy = null)
        {
            List<Guid>? restrictToIds = null;
            int? restrictToRegionId = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    restrictToRegionId = user.ManagedRegionId.Value;
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    restrictToIds = assignments.Select(a => a.DestinationId).ToList();
                }
            }
            else if (user?.Role.Name == RoleNames.SuperAdmin)
            {
                await SyncInactiveVisibilityAsync();
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                visibility = string.IsNullOrWhiteSpace(visibility) ? "active" : visibility;
            }
            else
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var hits = await _searchRepo.SearchDestinationsAsync(search, take: 200);
                var searchIds = hits.Select(h => h.Entity.Id).ToList();

                if (searchIds.Count == 0)
                    return (new List<AdminDestinationListDto>(), 0);

                restrictToIds = restrictToIds == null
                    ? searchIds
                    : restrictToIds.Intersect(searchIds).ToList();

                search = null;
            }

            var (items, total) = await _destinationRepo.GetAdminPagedAsync(
                search,
                cityId,
                visibility,
                regionId,
                typeId,
                minRating,
                maxRating,
                isFeatured,
                restrictToIds,
                restrictToRegionId,
                page,
                pageSize,
                extraFilters,
                sortBy);

            var viewCounts = await GetViewCountsAsync(items);
            var recentActiveIds = await GetRecentlyActiveIdsAsync("destination", items.Select(d => d.Id));
            return (items.Select(d => MapToListDto(d, viewCounts, recentActiveIds)).ToList(), total);
        }

        public async Task<(List<AdminDestinationListDto> Items, int Total)> GetDeletedAsync(
            string? search,
            int? cityId,
            int? regionId,
            int? typeId,
            int page,
            int pageSize,
            Guid currentUserId)
        {
            List<Guid>? restrictToIds = null;
            int? restrictToRegionId = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    restrictToRegionId = user.ManagedRegionId.Value;
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    restrictToIds = assignments.Select(a => a.DestinationId).ToList();
                }
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var query = _db.Destinations
                .IgnoreQueryFilters()
                .Include(d => d.City)
                    .ThenInclude(c => c!.Region)
                .Include(d => d.Country)
                .Include(d => d.Type)
                .Include(d => d.Images)
                .Where(d => d.IsDeleted)
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

            if (regionId.HasValue)
                query = query.Where(d =>
                    (d.RegionId != null && d.RegionId == regionId.Value)
                    || (d.RegionId == null && d.City != null && d.City.RegionId == regionId.Value));

            if (typeId.HasValue)
                query = query.Where(d => d.TypeId == typeId.Value);

            if (restrictToIds != null)
                query = query.Where(d => restrictToIds.Contains(d.Id));

            if (restrictToRegionId.HasValue)
                query = query.Where(d =>
                    (d.RegionId != null && d.RegionId == restrictToRegionId.Value)
                    || (d.RegionId == null && d.City != null && d.City.RegionId == restrictToRegionId.Value));

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(d => d.DeletedAt ?? d.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items.Select(d => MapToListDto(d)).ToList(), total);
        }

        public async Task<AdminDestinationStatsDto> GetStatsAsync(Guid currentUserId)
        {
            var destinationQuery = _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => !d.IsDeleted);

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    destinationQuery = destinationQuery.Where(d =>
                        (d.RegionId != null && d.RegionId == user.ManagedRegionId.Value)
                        || (d.RegionId == null && d.City != null && d.City.RegionId == user.ManagedRegionId.Value));
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    var destinationIds = assignments.Select(a => a.DestinationId).ToList();
                    destinationQuery = destinationQuery.Where(d => destinationIds.Contains(d.Id));
                }
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var now = DateTimeOffset.UtcNow;
            var recentCutoff = now.AddDays(-30);

            var destinationIdsQuery = destinationQuery.Select(d => d.Id);
            var logViewsQuery = _db.PopularityLogs
                .Where(l =>
                    l.EntityType == "destination" &&
                    l.Source == "click" &&
                    destinationIdsQuery.Contains(l.EntityId));

            var inactiveCount = await destinationQuery.CountAsync(d =>
                !_db.PopularityLogs.Any(l =>
                    l.EntityType == "destination" &&
                    l.EntityId == d.Id &&
                    l.Source == "click" &&
                    l.CreatedAt > recentCutoff));
            var addedLast30Days = await destinationQuery.CountAsync(d => d.CreatedAt > recentCutoff);
            var activeCount = await destinationQuery.CountAsync();

            // Deleted destinations — bypass IsDeleted filter but keep role scope
            var deletedQuery = _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => d.IsDeleted);
            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    deletedQuery = deletedQuery.Where(d =>
                        (d.RegionId != null && d.RegionId == user.ManagedRegionId.Value)
                        || (d.RegionId == null && d.City != null && d.City.RegionId == user.ManagedRegionId.Value));
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    var destinationIds = assignments.Select(a => a.DestinationId).ToList();
                    deletedQuery = deletedQuery.Where(d => destinationIds.Contains(d.Id));
                }
            }
            var deletedCount = await deletedQuery.CountAsync();

            var destinationStats = await destinationQuery
                .Select(d => new
                {
                    d.Id,
                    Name = d.Name,
                    d.Popularity
                })
                .ToListAsync();

            var loggedViews = await logViewsQuery
                .GroupBy(l => l.EntityId)
                .Select(g => new
                {
                    DestinationId = g.Key,
                    Views = g.Count()
                })
                .ToDictionaryAsync(x => x.DestinationId, x => x.Views);

            var totalViews = destinationStats.Sum(d => (long)loggedViews.GetValueOrDefault(d.Id, 0));

            var topDestinations = destinationStats
                .Select(d => new AdminDestinationTopItemDto
                {
                    Name = d.Name,
                    Views = loggedViews.GetValueOrDefault(d.Id, 0)
                })
                .OrderByDescending(d => d.Views)
                .ThenBy(d => d.Name)
                .Take(3)
                .ToList();

            var mostPopular = topDestinations.FirstOrDefault();

            return new AdminDestinationStatsDto
            {
                TotalViews = totalViews,
                ActiveCount = activeCount,
                DeletedCount = deletedCount,
                InactiveCount = inactiveCount,
                AddedLast30Days = addedLast30Days,
                MostPopularName = mostPopular?.Name ?? string.Empty,
                MostPopularViews = mostPopular?.Views ?? 0,
                TopDestinations = topDestinations
            };
        }

        public async Task<List<AdminDestinationLookupDto>> GetRegionsAsync(Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.SuperAdmin)
            {
                return await _db.Regions
                    .OrderBy(r => r.Name)
                    .Select(r => new AdminDestinationLookupDto
                    {
                        Id        = r.Id,
                        Name      = r.Name,
                        CountryId = r.CountryId
                    })
                    .ToListAsync();
            }

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                return await _db.Regions
                    .OrderBy(r => r.Name)
                    .Select(r => new AdminDestinationLookupDto
                    {
                        Id        = r.Id,
                        Name      = r.Name,
                        CountryId = r.CountryId
                    })
                    .ToListAsync();
            }

            if (user?.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            if (!user.ManagedRegionId.HasValue)
                return new List<AdminDestinationLookupDto>();

            return await _db.Regions
                .Where(r => r.Id == user.ManagedRegionId.Value)
                .Select(r => new AdminDestinationLookupDto
                {
                    Id        = r.Id,
                    Name      = r.Name,
                    CountryId = r.CountryId
                })
                .ToListAsync();
        }

        public async Task<List<AdminCountryLookupDto>> GetCountriesAsync()
        {
            return await _db.Countries
                .OrderBy(c => c.Name)
                .Select(c => new AdminCountryLookupDto
                {
                    Id   = c.Id,
                    Name = c.Name,
                    Code = c.Code
                })
                .ToListAsync();
        }

        public async Task<List<AdminDestinationLookupDto>> GetTypesAsync(Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name != RoleNames.SuperAdmin &&
                user?.Role.Name != RoleNames.TouristOrganization)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            return await _db.DestinationTypes
                .OrderBy(t => t.Name)
                .Select(t => new AdminDestinationLookupDto
                {
                    Id = t.Id,
                    Name = t.Name
                })
                .ToListAsync();
        }

        public async Task<AdminDestinationListDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var hasAccess = await HasDestinationAccessAsync(user, currentUserId, id);
                if (!hasAccess) return null;
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                var ownerDestination = await _destinationRepo.GetAdminByIdAsync(id);
                if (ownerDestination == null || ownerDestination.IsDeleted || !IsPublicDestination(ownerDestination))
                    return null;

                var ownerCount = await _db.PopularityLogs
                    .CountAsync(l => l.EntityType == "destination" && l.Source == "click" && l.EntityId == id);
                return MapToListDto(ownerDestination, new Dictionary<Guid, int> { [id] = ownerCount });
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null) return null;
            var viewCount = await _db.PopularityLogs
                .CountAsync(l => l.EntityType == "destination" && l.Source == "click" && l.EntityId == id);
            return MapToListDto(destination, new Dictionary<Guid, int> { [id] = viewCount });
        }

        /// <summary>
        /// City-type destinations represent a city themselves. If they don't have a CityId
        /// linked, look up an existing City with matching name (and region if available) or
        /// create one, then store its Id on the destination. Skips non-city destinations.
        /// </summary>
        /// <summary>
        /// Rejects creating a destination whose name collides with an existing one
        /// after Serbian-diacritic normalization ("Nis" == "Niš" == "NIS").
        /// </summary>
        private async Task EnsureUniqueNameAsync(string name)
        {
            var normalized = NameNormalizer.Normalize(name);
            if (normalized.Length == 0) return;
            var existingNames = await _db.Destinations
                .Where(d => !d.IsDeleted)
                .Select(d => d.Name)
                .ToListAsync();
            if (existingNames.Any(n => NameNormalizer.Normalize(n) == normalized))
                throw new InvalidOperationException($"Destinacija sa imenom \"{name.Trim()}\" već postoji.");
        }

        private async Task EnsureCityForCityTypeAsync(Destination destination)
        {
            if (destination.CityId.HasValue) return;
            if (destination.TypeId == null) return;

            var typeName = await _db.DestinationTypes
                .Where(t => t.Id == destination.TypeId.Value)
                .Select(t => t.Name)
                .FirstOrDefaultAsync();
            if (!string.Equals(typeName, "Grad", StringComparison.OrdinalIgnoreCase)) return;

            // Try existing city — prefer one with matching region, else any name match.
            City? existing = null;
            if (destination.RegionId.HasValue)
            {
                existing = await _db.Cities
                    .FirstOrDefaultAsync(c => c.Name == destination.Name && c.RegionId == destination.RegionId.Value);
            }
            existing ??= await _db.Cities.FirstOrDefaultAsync(c => c.Name == destination.Name);

            if (existing != null)
            {
                destination.CityId = existing.Id;
                return;
            }

            // Otherwise create a fresh city using the destination's own attributes.
            var now = DateTimeOffset.UtcNow;
            var lat = destination.Latitude ?? 0;
            var lng = destination.Longitude ?? 0;
            var city = new City
            {
                Name      = destination.Name,
                RegionId  = destination.RegionId,
                Latitude  = lat,
                Longitude = lng,
                Location  = _geometryFactory.CreatePoint(new Coordinate(lng, lat)),
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = destination.CreatedBy,
                UpdatedBy = destination.UpdatedBy,
            };
            _db.Cities.Add(city);
            await _db.SaveChangesAsync();
            destination.CityId = city.Id;
        }

        public async Task<AdminDestinationListDto> CreateAsync(AdminCreateDestinationDto dto, Guid createdBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(createdBy);
            if (user?.Role.Name != RoleNames.SuperAdmin && user?.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Only SuperAdmin or TouristOrganization can create destinations.");

            if (user.Role.Name == RoleNames.TouristOrganization && user.ManagedRegionId.HasValue)
                await ValidateLocationWithinRegionAsync(dto.Latitude, dto.Longitude, user.ManagedRegionId.Value);

            await EnsureUniqueNameAsync(dto.Name);

            var now = DateTimeOffset.UtcNow;

            var destination = new Destination
            {
                Id          = Guid.NewGuid(),
                Name        = dto.Name,
                Slug        = dto.Slug,
                Description = dto.Description,
                Address     = dto.Address,
                Latitude    = dto.Latitude,
                Longitude   = dto.Longitude,
                Location    = _geometryFactory.CreatePoint(new Coordinate(dto.Longitude, dto.Latitude)),
                CityId      = dto.CityId,
                RegionId    = dto.RegionId,
                CountryId   = dto.CountryId,
                HeroImageUrl = dto.HeroImageUrl,
                Visibility  = dto.Visibility,
                TypeId      = dto.TypeId,
                ExtraFilters = dto.ExtraFilters != null ? JsonSerializer.Serialize(dto.ExtraFilters) : null,
                CreatedAt   = now,
                UpdatedAt   = now,
                CreatedBy   = createdBy,
                UpdatedBy   = createdBy
            };

            await _destinationRepo.AddAsync(destination);
            await _destinationRepo.SaveChangesAsync();

            await EnsureCityForCityTypeAsync(destination);
            if (_db.Entry(destination).State == EntityState.Modified)
                await _db.SaveChangesAsync();

            var created = await _destinationRepo.GetAdminByIdAsync(destination.Id);
            return MapToListDto(created!);
        }

        public async Task<AdminDestinationListDto?> UpdateAsync(
            Guid id, AdminUpdateDestinationDto dto, Guid updatedBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(updatedBy);
            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var hasAccess = await HasDestinationAccessAsync(user, updatedBy, id);
                if (!hasAccess)
                    throw new UnauthorizedAccessException("You do not have access to this destination.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Only SuperAdmin or TouristOrganization can update destinations.");
            }

            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null) return null;

            if (dto.Name        != null) destination.Name        = dto.Name;
            if (dto.Slug        != null) destination.Slug        = dto.Slug;
            if (dto.Description != null) destination.Description = dto.Description;
            destination.Address = dto.Address;
            if (dto.HeroImageUrl!= null) destination.HeroImageUrl= dto.HeroImageUrl;
            if (dto.Visibility  != null) destination.Visibility  = dto.Visibility;
            if (dto.CityId    != null) destination.CityId = dto.CityId;

            if (dto.ClearRegionId)              destination.RegionId  = null;
            else if (dto.RegionId.HasValue)     destination.RegionId  = dto.RegionId.Value;

            if (dto.ClearCountryId)             destination.CountryId = null;
            else if (dto.CountryId.HasValue)    destination.CountryId = dto.CountryId.Value;

            if (dto.Latitude.HasValue && dto.Longitude.HasValue)
            {
                if (user?.Role.Name == RoleNames.TouristOrganization && user.ManagedRegionId.HasValue)
                    await ValidateLocationWithinRegionAsync(dto.Latitude.Value, dto.Longitude.Value, user.ManagedRegionId.Value);

                destination.Latitude  = dto.Latitude.Value;
                destination.Longitude = dto.Longitude.Value;
                destination.Location  = _geometryFactory.CreatePoint(
                    new Coordinate(dto.Longitude.Value, dto.Latitude.Value));
            }

            if (dto.ClearTypeId)      destination.TypeId = null;
            else if (dto.TypeId.HasValue) destination.TypeId = dto.TypeId.Value;

            if (dto.ExtraFilters != null)
                destination.ExtraFilters = JsonSerializer.Serialize(dto.ExtraFilters);

            destination.UpdatedAt = DateTimeOffset.UtcNow;
            destination.UpdatedBy = updatedBy;

            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();

            await EnsureCityForCityTypeAsync(destination);
            if (_db.Entry(destination).State == EntityState.Modified)
                await _db.SaveChangesAsync();

            var updated = await _destinationRepo.GetAdminByIdAsync(id);
            return MapToListDto(updated!);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null) return false;

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    destination.City?.RegionId != user.ManagedRegionId.Value)
                    throw new UnauthorizedAccessException("Pristup odbijen.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Pristup odbijen.");
            }

            destination.IsDeleted = true;
            destination.DeletedAt = DateTimeOffset.UtcNow;
            destination.UpdatedAt = DateTimeOffset.UtcNow;
            destination.UpdatedBy = currentUserId;

            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();
            await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync(
                "destination",
                destination.Id,
                destination.Name);

            return true;
        }

        public async Task<EntityDependenciesDto> GetDependenciesAsync(Guid id, string tab, int page, int pageSize)
        {
            // Uzimamo objekte ove destinacije da bismo mogli da nadjemo dogadjaje vezane kroz objekat
            var placeLookup = await _db.Places.IgnoreQueryFilters()
                .Where(p => p.DestinationId == id && !p.IsDeleted)
                .Select(p => new { p.Id, p.Name })
                .ToListAsync();
            var placeIdDict = placeLookup.ToDictionary(p => p.Id, p => p.Name);
            var placeIdList = placeIdDict.Keys.ToList();

            var placeCount = placeLookup.Count;
            var activityCount = await _db.Activities.IgnoreQueryFilters()
                .CountAsync(a => a.DestinationId == id && !a.IsDeleted);

            // Dogadjaji: direktno vezani za destinaciju + vezani kroz objekat (bez duplikata)
            IQueryable<Explorea.API.Models.Event> eventsQuery;
            if (placeIdList.Count > 0)
            {
                eventsQuery = _db.Events.IgnoreQueryFilters()
                    .Include(e => e.Type).Include(e => e.City)
                    .Where(e => !e.IsDeleted && (
                        e.DestinationId == id ||
                        (e.PlaceId != null && placeIdList.Contains(e.PlaceId.Value) &&
                         (e.DestinationId == null || e.DestinationId != id))));
            }
            else
            {
                eventsQuery = _db.Events.IgnoreQueryFilters()
                    .Include(e => e.Type).Include(e => e.City)
                    .Where(e => !e.IsDeleted && e.DestinationId == id);
            }

            var eventCount = await eventsQuery.CountAsync();
            var skip = (page - 1) * pageSize;
            var items = new List<DependencyItemDto>();
            int total = 0;

            if (tab == "places")
            {
                total = placeCount;
                items = await _db.Places.IgnoreQueryFilters()
                    .Where(p => p.DestinationId == id && !p.IsDeleted)
                    .OrderBy(p => p.Name)
                    .Skip(skip).Take(pageSize)
                    .Select(p => new DependencyItemDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        PreviewImageUrl = p.PreviewImageUrl,
                        TypeLabel = p.Type != null ? p.Type.Name : null,
                        City = p.City != null ? p.City.Name : null,
                        AvgRating = p.AvgRating,
                        EntityType = "place"
                    }).ToListAsync();
            }
            else if (tab == "activities")
            {
                total = activityCount;
                items = await _db.Activities.IgnoreQueryFilters()
                    .Include(a => a.Category)
                    .Include(a => a.City)
                    .Where(a => a.DestinationId == id && !a.IsDeleted)
                    .OrderBy(a => a.Name)
                    .Skip(skip).Take(pageSize)
                    .Select(a => new DependencyItemDto
                    {
                        Id = a.Id,
                        Name = a.Name,
                        PreviewImageUrl = a.PreviewImageUrl,
                        TypeLabel = a.Category != null ? a.Category.Name : null,
                        City = a.City != null ? a.City.Name : null,
                        AvgRating = a.AvgRating,
                        EntityType = "activity"
                    }).ToListAsync();
            }
            else // events (default)
            {
                total = eventCount;
                var eventEntities = await eventsQuery
                    .OrderBy(e => e.StartDatetime)
                    .Skip(skip).Take(pageSize)
                    .ToListAsync();

                items = eventEntities.Select(e => new DependencyItemDto
                {
                    Id = e.Id,
                    Name = e.Name,
                    PreviewImageUrl = e.PreviewImageUrl,
                    TypeLabel = e.Type?.Name,
                    City = e.City?.Name,
                    AvgRating = e.AvgRating,
                    EntityType = "event",
                    StartDate = e.StartDatetime.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    ViaPlaceName = e.PlaceId.HasValue
                        && placeIdDict.ContainsKey(e.PlaceId.Value)
                        && (e.DestinationId == null || e.DestinationId != id)
                            ? placeIdDict[e.PlaceId.Value]
                            : null
                }).ToList();
            }

            return new EntityDependenciesDto
            {
                EventCount = eventCount,
                PlaceCount = placeCount,
                ActivityCount = activityCount,
                Items = items,
                Total = total
            };
        }

        public async Task<bool> DeleteCascadeAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null) return false;

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    destination.City?.RegionId != user.ManagedRegionId.Value)
                    throw new UnauthorizedAccessException("Pristup odbijen.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Pristup odbijen.");
            }

            var now = DateTimeOffset.UtcNow;

            // Direktno vezani dogadjaji za destinaciju
            var events = await _db.Events.IgnoreQueryFilters()
                .Where(e => e.DestinationId == id && !e.IsDeleted).ToListAsync();

            // Objekti ove destinacije
            var places = await _db.Places.IgnoreQueryFilters()
                .Where(p => p.DestinationId == id && !p.IsDeleted).ToListAsync();

            // Dogadjaji vezani kroz objekte (koji nisu vec pokriveni direktnom vezom)
            var placeIds = places.Select(p => p.Id).ToList();
            var directEventIds = events.Select(e => e.Id).ToHashSet();
            var eventsViaPlaces = placeIds.Count > 0
                ? await _db.Events.IgnoreQueryFilters()
                    .Where(e => e.PlaceId != null && placeIds.Contains(e.PlaceId.Value)
                                && !e.IsDeleted && !directEventIds.Contains(e.Id))
                    .ToListAsync()
                : new List<Explorea.API.Models.Event>();

            var activities = await _db.Activities.IgnoreQueryFilters()
                .Where(a => a.DestinationId == id && !a.IsDeleted).ToListAsync();

            foreach (var ev in events.Concat(eventsViaPlaces))
            {
                ev.IsDeleted = true;
                ev.DeletedAt = now;
                ev.UpdatedAt = now;
                ev.UpdatedBy = currentUserId;
            }

            foreach (var pl in places)
            {
                pl.IsDeleted = true;
                pl.DeletedAt = now;
                pl.UpdatedAt = now;
                pl.UpdatedBy = currentUserId;
            }

            foreach (var act in activities)
            {
                act.IsDeleted = true;
                act.DeletedAt = now;
                act.UpdatedAt = now;
                act.UpdatedBy = currentUserId;
            }

            destination.IsDeleted = true;
            destination.DeletedAt = now;
            destination.UpdatedAt = now;
            destination.UpdatedBy = currentUserId;

            await _db.SaveChangesAsync();

            foreach (var ev in events.Concat(eventsViaPlaces))
                await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync("event", ev.Id, ev.Name);
            foreach (var pl in places)
                await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync("place", pl.Id, pl.Name);
            foreach (var act in activities)
                await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync("activity", act.Id, act.Name);
            await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync("destination", destination.Id, destination.Name);

            await SendCascadeDeletionEmailsAsync(
                "destinacije",
                destination.Name,
                events.Concat(eventsViaPlaces).Select(e => (e.CreatedBy, "Dogadjaj", e.Name)),
                places.Select(p => (p.CreatedBy, "Objekat", p.Name)),
                activities.Select(a => (a.CreatedBy, "Aktivnost", a.Name)),
                currentUserId);

            return true;
        }

        private async Task SendCascadeDeletionEmailsAsync(
            string parentEntityType,
            string parentEntityName,
            IEnumerable<(Guid? CreatedBy, string EntityType, string EntityName)> events,
            IEnumerable<(Guid? CreatedBy, string EntityType, string EntityName)> places,
            IEnumerable<(Guid? CreatedBy, string EntityType, string EntityName)> activities,
            Guid currentUserId)
        {
            var allItems = events.Concat(places).Concat(activities)
                .Where(x => x.CreatedBy.HasValue && x.CreatedBy.Value != currentUserId)
                .GroupBy(x => x.CreatedBy!.Value);

            foreach (var group in allItems)
            {
                var owner = await _userRepo.GetByIdWithRoleAsync(group.Key);
                if (owner == null || string.IsNullOrWhiteSpace(owner.Email)) continue;

                var items = group.Select(g => (g.EntityType, g.EntityName)).ToList();
                try
                {
                    await _emailService.SendCascadeDeletionEmailAsync(
                        owner.Email,
                        string.IsNullOrWhiteSpace(owner.FirstName) ? owner.Email : owner.FirstName,
                        parentEntityType,
                        parentEntityName,
                        items);
                }
                catch { }
            }
        }

        public async Task<bool> RestoreAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can restore destinations.");

            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null || !destination.IsDeleted) return false;

            destination.IsDeleted = false;
            destination.DeletedAt = null;
            destination.UpdatedAt = DateTimeOffset.UtcNow;
            destination.UpdatedBy = currentUserId;

            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();

            return true;
        }

        // ---- Helpers ----

        private static AdminDestinationListDto MapToListDto(
            Destination d,
            IReadOnlyDictionary<Guid, int>? viewCounts = null,
            HashSet<Guid>? recentlyActiveIds = null) => new()
        {
            Id              = d.Id,
            Name            = d.Name,
            Slug            = d.Slug,
            PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
            Region          = d.Region?.Name ?? d.City?.Region?.Name,
            RegionId        = d.RegionId ?? d.City?.RegionId,
            CityId          = d.CityId,
            Views           = viewCounts?.GetValueOrDefault(d.Id) ?? 0,
            Status          = MapStatus(d.Visibility),
            HasRecentActivity = recentlyActiveIds?.Contains(d.Id) ?? (d.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-30)),
            TypeId          = d.TypeId,
            TypeName        = d.Type?.Name,
            AvgRating       = d.AvgRating,
            IsFeatured      = d.IsFeatured,
            Visibility      = d.Visibility,
            City            = d.City?.Name,
            CountryId       = d.CountryId,
            Country         = d.Country?.Name,
            Description     = d.Description,
            Address         = d.Address,
            Latitude        = d.Latitude,
            Longitude       = d.Longitude,
            Images          = d.Images
                                .OrderBy(i => i.SortOrder)
                                .Select(i => new AdminDestinationImageDto
                                {
                                    Id       = i.Id,
                                    ImageUrl = i.ImageUrl,
                                    SortOrder = i.SortOrder
                                })
                                .ToList(),
            CreatedAt       = d.CreatedAt,
            UpdatedAt       = d.UpdatedAt,
            ExtraFilters    = JsonbDictionaryHelper.ParseStringDictionary(d.ExtraFilters),
            DeletedAt       = d.DeletedAt
        };

        private static bool IsPublicDestination(Destination destination)
        {
            var visibility = destination.Visibility?.Trim().ToLowerInvariant();
            return visibility is "active" or "published";
        }

        /// <summary>
        /// Returns the subset of ids that had at least one popularity-log event
        /// in the last 30 days — used to flag entities as "Aktivno" in the admin
        /// table. Brand-new rows (without log events yet) are not included here;
        /// the mapper falls back to CreatedAt so they aren't unfairly marked
        /// neaktivno during their first month.
        /// </summary>
        private async Task<HashSet<Guid>> GetRecentlyActiveIdsAsync(string entityType, IEnumerable<Guid> ids)
        {
            var idList = ids.ToList();
            if (idList.Count == 0) return new HashSet<Guid>();
            var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);
            var hits = await _db.PopularityLogs
                .Where(l => l.EntityType == entityType && idList.Contains(l.EntityId) && l.CreatedAt >= thirtyDaysAgo)
                .Select(l => l.EntityId)
                .Distinct()
                .ToListAsync();
            return hits.ToHashSet();
        }

        private async Task<Dictionary<Guid, int>> GetViewCountsAsync(List<Destination> destinations)
        {
            var ids = destinations.Select(d => d.Id).ToList();
            if (ids.Count == 0)
                return new Dictionary<Guid, int>();

            var loggedViews = await _db.PopularityLogs
                .Where(l => l.EntityType == "destination" && l.Source == "click" && ids.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new
                {
                    DestinationId = g.Key,
                    Views = g.Count()
                })
                .ToDictionaryAsync(x => x.DestinationId, x => x.Views);

            return loggedViews;
        }

        private static string MapStatus(string visibility)
        {
            return visibility.Trim().ToLower() switch
            {
                "published" => "active",
                "active" => "active",
                "draft" => "pending",
                "pending" => "pending",
                "archived" => "inactive",
                "inactive" => "inactive",
                "rejected" => "rejected",
                _ => "inactive"
            };
        }

        private async Task<bool> HasDestinationAccessAsync(User user, Guid userId, Guid destinationId)
        {
            if (user.ManagedRegionId.HasValue)
            {
                return await _db.Destinations
                    .IgnoreQueryFilters()
                    .AnyAsync(d =>
                        d.Id == destinationId &&
                        !d.IsDeleted &&
                        ((d.RegionId != null && d.RegionId == user.ManagedRegionId.Value)
                         || (d.RegionId == null && d.City != null && d.City.RegionId == user.ManagedRegionId.Value)));
            }

            return await _assignmentRepo.ExistsAsync(userId, destinationId);
        }

        public async Task<AdminDestinationImageDto> AddImageAsync(Guid destinationId, IFormFile file, Guid userId)
        {
            var destination = await _destinationRepo.GetAdminByIdAsync(destinationId)
                ?? throw new KeyNotFoundException("Destination not found.");

            var imageCount = await _db.DestinationImages
                .CountAsync(i => i.DestinationId == destinationId);

            if (imageCount >= 10)
                throw new InvalidOperationException("Maximum of 10 images allowed per destination.");

            if (!file.ContentType.StartsWith("image/"))
                throw new InvalidOperationException("Only image files are allowed.");

            if (file.Length > 5 * 1024 * 1024)
                throw new InvalidOperationException("File size must be under 5 MB.");

            var url = await _cloudinary.UploadLandscapeAsync(file, "destination-images");

            var maxOrder = await _db.DestinationImages
                .Where(i => i.DestinationId == destinationId)
                .MaxAsync(i => (int?)i.SortOrder) ?? -1;

            var image = new DestinationImage
            {
                Id            = Guid.NewGuid(),
                DestinationId = destinationId,
                ImageUrl      = url,
                SortOrder     = maxOrder + 1,
                CreatedAt     = DateTimeOffset.UtcNow,
                CreatedBy     = userId
            };

            _db.DestinationImages.Add(image);
            await _db.SaveChangesAsync();

            return new AdminDestinationImageDto
            {
                Id        = image.Id,
                ImageUrl  = image.ImageUrl,
                SortOrder = image.SortOrder
            };
        }

        public async Task<bool> DeleteImageAsync(Guid destinationId, Guid imageId, Guid userId)
        {
            var image = await _db.DestinationImages
                .FirstOrDefaultAsync(i => i.Id == imageId && i.DestinationId == destinationId);

            if (image == null) return false;

            _db.DestinationImages.Remove(image);

            var destination = await _destinationRepo.GetAdminByIdAsync(destinationId);
            if (destination != null && destination.PreviewImageUrl == image.ImageUrl)
            {
                destination.PreviewImageUrl = null;
                destination.UpdatedAt = DateTimeOffset.UtcNow;
                _destinationRepo.Update(destination);
            }

            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<string?> SetPreviewImageAsync(Guid destinationId, Guid imageId, Guid userId)
        {
            var image = await _db.DestinationImages
                .FirstOrDefaultAsync(i => i.Id == imageId && i.DestinationId == destinationId);

            if (image == null) return null;

            var destination = await _destinationRepo.GetAdminByIdAsync(destinationId);
            if (destination == null) return null;

            destination.PreviewImageUrl = image.ImageUrl;
            destination.UpdatedAt = DateTimeOffset.UtcNow;
            destination.UpdatedBy = userId;
            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();

            return image.ImageUrl;
        }

        public async Task<AdminDestinationLookupDto> CreateTypeAsync(string name, Guid userId)
        {
            var trimmed = name.Trim();
            if (string.IsNullOrEmpty(trimmed))
                throw new ArgumentException("Type name cannot be empty.");

            var existing = await _db.DestinationTypes
                .FirstOrDefaultAsync(t => t.Name.ToLower() == trimmed.ToLower());
            if (existing != null)
                return new AdminDestinationLookupDto { Id = existing.Id, Name = existing.Name };

            var now = DateTimeOffset.UtcNow;
            var type = new DestinationType
            {
                Name      = trimmed,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = userId,
                UpdatedBy = userId,
            };
            _db.DestinationTypes.Add(type);
            await _db.SaveChangesAsync();

            return new AdminDestinationLookupDto { Id = type.Id, Name = type.Name };
        }

        /// <summary>
        /// One-shot backfill: finds all destinations of type "Grad" that have no CityId and
        /// links them to a matching city (creating one if needed). Returns the number of rows touched.
        /// </summary>
        public async Task<int> BackfillCityForCityTypeDestinationsAsync(Guid userId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(userId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can run this backfill.");

            var gradTypeId = await _db.DestinationTypes
                .Where(t => t.Name.ToLower() == "grad")
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync();
            if (gradTypeId == null) return 0;

            var candidates = await _db.Destinations
                .Where(d => d.TypeId == gradTypeId.Value && d.CityId == null && !d.IsDeleted)
                .ToListAsync();

            var touched = 0;
            foreach (var dest in candidates)
            {
                await EnsureCityForCityTypeAsync(dest);
                if (dest.CityId.HasValue) touched++;
            }
            if (touched > 0) await _db.SaveChangesAsync();
            return touched;
        }

        private async Task ValidateLocationWithinRegionAsync(double lat, double lng, int regionId)
        {
            var region = await _db.Regions.AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == regionId);

            if (region?.Boundary == null) return;

            var point = _geometryFactory.CreatePoint(new Coordinate(lng, lat));
            if (!region.Boundary.Covers(point))
                throw new InvalidOperationException(
                    $"Lokacija se nalazi van granica regiona \"{region.Name}\". Pomeri pin unutar granica regiona.");
        }

        private async Task SyncInactiveVisibilityAsync()
        {
            var recentCutoff = DateTimeOffset.UtcNow.AddDays(-30);

            // published → inactive: row has aged past the 30-day grace period and nobody
            // has clicked it in the last 30 days, so it should drop to "Neaktivno".
            await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d =>
                    !d.IsDeleted &&
                    d.Visibility == "published" &&
                    d.CreatedAt < recentCutoff &&
                    !_db.PopularityLogs.Any(l =>
                        l.EntityType == "destination" &&
                        l.EntityId == d.Id &&
                        l.Source == "click" &&
                        l.CreatedAt > recentCutoff))
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.Visibility, "inactive"));

            // inactive → published: someone clicked an inactive row recently — flip it
            // back to "Aktivno" so the admin pill reflects the latest activity instead
            // of remaining frozen at "Neaktivno".
            await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d =>
                    !d.IsDeleted &&
                    d.Visibility == "inactive" &&
                    _db.PopularityLogs.Any(l =>
                        l.EntityType == "destination" &&
                        l.EntityId == d.Id &&
                        l.Source == "click" &&
                        l.CreatedAt > recentCutoff))
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.Visibility, "published"));
        }
    }
}
