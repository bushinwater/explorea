using Explorea.API.DTOs.Admin.Destination;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
    public class AdminDestinationService : IAdminDestinationService
    {
        private readonly IDestinationRepository _destinationRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IUserRepository _userRepo;
        private readonly AppDbContext _db;

        private static readonly GeometryFactory _geometryFactory =
            new GeometryFactory(new PrecisionModel(), 4326);

        public AdminDestinationService(
            IDestinationRepository destinationRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IUserRepository userRepo,
            AppDbContext db)
        {
            _destinationRepo = destinationRepo;
            _assignmentRepo  = assignmentRepo;
            _userRepo        = userRepo;
            _db              = db;
        }

        public async Task<(List<AdminDestinationListDto> Items, int Total)> GetAllAsync(
            string? search,
            int? cityId,
            string? visibility,
            int? regionId,
            int? typeId,
            decimal? minRating,
            decimal? maxRating,
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

            var (items, total) = await _destinationRepo.GetAdminPagedAsync(
                search,
                cityId,
                visibility,
                regionId,
                typeId,
                minRating,
                maxRating,
                restrictToIds,
                restrictToRegionId,
                page,
                pageSize);

            var viewCounts = await GetViewCountsAsync(items);
            return (items.Select(d => MapToListDto(d, viewCounts)).ToList(), total);
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
                        d.City != null && d.City.RegionId == user.ManagedRegionId.Value);
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

            var totalViews = destinationStats.Sum(d => (long)loggedViews.GetValueOrDefault(d.Id, d.Popularity));

            var topDestinations = destinationStats
                .Select(d => new AdminDestinationTopItemDto
                {
                    Name = d.Name,
                    Views = loggedViews.GetValueOrDefault(d.Id, d.Popularity)
                })
                .OrderByDescending(d => d.Views)
                .ThenBy(d => d.Name)
                .Take(3)
                .ToList();

            var mostPopular = topDestinations.FirstOrDefault();

            return new AdminDestinationStatsDto
            {
                TotalViews = totalViews,
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
                        Id = r.Id,
                        Name = r.Name
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
                    Id = r.Id,
                    Name = r.Name
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
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            return destination == null ? null : MapToListDto(destination);
        }

        public async Task<AdminDestinationListDto> CreateAsync(AdminCreateDestinationDto dto, Guid createdBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(createdBy);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can create destinations.");

            var now = DateTimeOffset.UtcNow;

            var destination = new Destination
            {
                Id          = Guid.NewGuid(),
                Name        = dto.Name,
                Slug        = dto.Slug,
                Description = dto.Description,
                Latitude    = dto.Latitude,
                Longitude   = dto.Longitude,
                Location    = _geometryFactory.CreatePoint(new Coordinate(dto.Longitude, dto.Latitude)),
                CityId      = dto.CityId,
                CountryId   = dto.CountryId,
                HeroImageUrl = dto.HeroImageUrl,
                Visibility  = dto.Visibility,
                CreatedAt   = now,
                UpdatedAt   = now,
                CreatedBy   = createdBy,
                UpdatedBy   = createdBy
            };

            await _destinationRepo.AddAsync(destination);
            await _destinationRepo.SaveChangesAsync();

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
            if (dto.HeroImageUrl!= null) destination.HeroImageUrl= dto.HeroImageUrl;
            if (dto.Visibility  != null) destination.Visibility  = dto.Visibility;
            if (dto.CityId      != null) destination.CityId      = dto.CityId;
            if (dto.CountryId   != null) destination.CountryId   = dto.CountryId;

            if (dto.Latitude.HasValue && dto.Longitude.HasValue)
            {
                destination.Latitude  = dto.Latitude.Value;
                destination.Longitude = dto.Longitude.Value;
                destination.Location  = _geometryFactory.CreatePoint(
                    new Coordinate(dto.Longitude.Value, dto.Latitude.Value));
            }

            destination.UpdatedAt = DateTimeOffset.UtcNow;
            destination.UpdatedBy = updatedBy;

            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();

            var updated = await _destinationRepo.GetAdminByIdAsync(id);
            return MapToListDto(updated!);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can delete destinations.");

            var destination = await _destinationRepo.GetAdminByIdAsync(id);
            if (destination == null) return false;

            destination.IsDeleted = true;
            destination.DeletedAt = DateTimeOffset.UtcNow;

            _destinationRepo.Update(destination);
            await _destinationRepo.SaveChangesAsync();

            return true;
        }

        // ---- Helpers ----

        private static AdminDestinationListDto MapToListDto(
            Destination d,
            IReadOnlyDictionary<Guid, int>? viewCounts = null) => new()
        {
            Id             = d.Id,
            Name           = d.Name,
            Slug           = d.Slug,
            PreviewImageUrl= d.PreviewImageUrl ?? d.HeroImageUrl,
            Region         = d.City?.Region?.Name,
            RegionId       = d.City?.RegionId,
            Views          = viewCounts?.GetValueOrDefault(d.Id) ?? d.Popularity,
            Status         = MapStatus(d.Visibility),
            TypeId         = d.TypeId,
            TypeName       = d.Type?.Name,
            AvgRating      = d.AvgRating,
            IsFeatured     = d.IsFeatured,
            Visibility     = d.Visibility,
            City           = d.City?.Name,
            Country        = d.Country?.Name,
            CreatedAt      = d.CreatedAt,
            UpdatedAt      = d.UpdatedAt
        };

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

            foreach (var destination in destinations)
            {
                if (!loggedViews.ContainsKey(destination.Id) && destination.Popularity > 0)
                    loggedViews[destination.Id] = destination.Popularity;
            }

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
                        d.City != null &&
                        d.City.RegionId == user.ManagedRegionId.Value);
            }

            return await _assignmentRepo.ExistsAsync(userId, destinationId);
        }
    }
}
