using Explorea.API.DTOs.Admin.Destination;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
    public class AdminDestinationService : IAdminDestinationService
    {
        private readonly IDestinationRepository _destinationRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IUserRepository _userRepo;

        private static readonly GeometryFactory _geometryFactory =
            new GeometryFactory(new PrecisionModel(), 4326);

        public AdminDestinationService(
            IDestinationRepository destinationRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IUserRepository userRepo)
        {
            _destinationRepo = destinationRepo;
            _assignmentRepo  = assignmentRepo;
            _userRepo        = userRepo;
        }

        public async Task<(List<AdminDestinationListDto> Items, int Total)> GetAllAsync(
            int? cityId, string? visibility, int page, int pageSize, Guid currentUserId)
        {
            List<Guid>? restrictToIds = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                restrictToIds = assignments.Select(a => a.DestinationId).ToList();
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var (items, total) = await _destinationRepo.GetAdminPagedAsync(
                cityId, visibility, restrictToIds, page, pageSize);

            return (items.Select(MapToListDto).ToList(), total);
        }

        public async Task<AdminDestinationListDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var hasAccess = await _assignmentRepo.ExistsAsync(currentUserId, id);
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
                var hasAccess = await _assignmentRepo.ExistsAsync(updatedBy, id);
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

        private static AdminDestinationListDto MapToListDto(Destination d) => new()
        {
            Id             = d.Id,
            Name           = d.Name,
            Slug           = d.Slug,
            PreviewImageUrl= d.PreviewImageUrl ?? d.HeroImageUrl,
            Region         = d.City?.Region?.Name,
            RegionId       = d.City?.RegionId,
            Views          = d.Popularity,
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
    }
}
