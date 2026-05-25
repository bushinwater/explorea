using System.Text.Json;
using Explorea.API.DTOs.Admin.Event;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminEventService : IAdminEventService
    {
        private readonly IAdminEventRepository _eventRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IDestinationRepository _destinationRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISubmissionQueueRepository _queueRepo;
        private readonly ILookupRepository _lookupRepo;

        public AdminEventService(
            IAdminEventRepository eventRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IDestinationRepository destinationRepo,
            ISubmissionQueueRepository queueRepo,
            IUserRepository userRepo,
            ILookupRepository lookupRepo)
        {
            _eventRepo       = eventRepo;
            _assignmentRepo  = assignmentRepo;
            _destinationRepo = destinationRepo;
            _queueRepo       = queueRepo;
            _userRepo        = userRepo;
            _lookupRepo      = lookupRepo;
        }

        public async Task<AdminEventStatsDto> GetStatsDtoAsync(Guid currentUserId)
        {
            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);
            
            var activeCount = await _eventRepo.CountActiveAsync(
                restrictToDestinationIds,
                restrictToCityIds
            );

            var pendingCount = await _queueRepo.CountAsync(
                entityType: "event",
                statuses: new[] { "Pending" },
                restrictToDestinationIds: restrictToDestinationIds
            );

            var rejectedCount = await _queueRepo.CountAsync(
                entityType: "event",
                statuses: new[] { "RejectedByTO", "RejectedByOwner" },
                restrictToDestinationIds: restrictToDestinationIds
            );

            var now = DateTimeOffset.UtcNow;
            var monthStart = new DateTimeOffset(
                now.Year,
                now.Month,
                1,
                0,
                0,
                0,
                TimeSpan.Zero
            );

            var approvedThisMonth = await _queueRepo.CountAsync(
                entityType: "event",
                statuses: new[] { "ApprovedByTO", "ApprovedByOwner" },
                restrictToDestinationIds: restrictToDestinationIds,
                reviewedByTOFrom: monthStart
            );

            return new AdminEventStatsDto
            {
                ActiveRequests = activeCount,
                ActiveRequestsTrend = string.Empty,

                PendingApproval = pendingCount,
                PendingApprovalHint = "Zahtevi na čekanju",

                ApprovedThisMonth = approvedThisMonth,
                ApprovedThisMonthTrend = "Odobreno ovog meseca",

                Rejected = rejectedCount,
                RejectedNote = "Odbijeni zahtevi",

                TabPendingCount = pendingCount,
                TabActiveCount = activeCount
            };
        }

        private async Task<(List<Guid>? RestrictToDestinationIds, List<int>? RestrictToCityIds)>
            GetAccessRestrictionsAsync(Guid currentUserId)
        {
            List<Guid>? restrictToDestinationIds = null;
            List<int>? restrictToCityIds = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    var cities = await _lookupRepo.GetCitiesAsync(user.ManagedRegionId);
                    restrictToCityIds = cities.Select(c => c.Id).ToList();
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    restrictToDestinationIds = assignments.Select(a => a.DestinationId).ToList();
                    restrictToCityIds = await _destinationRepo
                        .GetCityIdsByDestinationsAsync(restrictToDestinationIds);
                }
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            return (restrictToDestinationIds, restrictToCityIds);
        }

        public async Task<(List<AdminEventListDto> Items, int Total)> GetAllAsync(
            string? search,
            Guid? destinationId, int? cityId, int? typeId,
            DateTimeOffset? startFrom, DateTimeOffset? startTo,
            List<string>? extraFilters,
            int page, int pageSize, Guid currentUserId)
        {
            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);

            var (items, total) = await _eventRepo.GetAdminPagedAsync(
                search,
                destinationId, cityId, typeId,
                startFrom, startTo,
                extraFilters,
                restrictToDestinationIds, restrictToCityIds,
                page, pageSize);

            return (items.Select(MapToListDto).ToList(), total);
        }

        public async Task<AdminEventDetailDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var ev = await _eventRepo.GetAdminByIdAsync(id);
                if (ev == null) return null;

                if (!await HasTOAccessToEvent(currentUserId, ev))
                    return null;

                return MapToDetailDto(ev);
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var found = await _eventRepo.GetAdminByIdAsync(id);
            return found == null ? null : MapToDetailDto(found);
        }

        public async Task<AdminEventDetailDto> CreateAsync(AdminCreateEventDto dto, Guid createdBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(createdBy);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can create events.");

            var now = DateTimeOffset.UtcNow;

            var ev = new Event
            {
                Id            = Guid.NewGuid(),
                Name          = dto.Name,
                Slug          = dto.Slug,
                Description   = dto.Description,
                TypeId        = dto.TypeId,
                StartDatetime = dto.StartDatetime,
                EndDatetime   = dto.EndDatetime,
                Price         = dto.Price,
                Address       = dto.Address,
                Latitude      = dto.Latitude,
                Longitude     = dto.Longitude,
                TicketUrl     = dto.TicketUrl,
                CityId        = dto.CityId,
                CountryId     = dto.CountryId,
                DestinationId = dto.DestinationId,
                PlaceId       = dto.PlaceId,
                IsFeatured    = dto.IsFeatured,
                ExtraFilters  = dto.ExtraFilters != null ? JsonSerializer.Serialize(dto.ExtraFilters) : null,
                CreatedAt     = now,
                UpdatedAt     = now,
                CreatedBy     = createdBy,
                UpdatedBy     = createdBy
            };

            await _eventRepo.AddAsync(ev);
            await _eventRepo.SaveChangesAsync();

            var created = await _eventRepo.GetAdminByIdAsync(ev.Id);
            return MapToDetailDto(created!);
        }

        public async Task<AdminEventDetailDto?> UpdateAsync(Guid id, AdminUpdateEventDto dto, Guid updatedBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(updatedBy);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var ev = await _eventRepo.GetAdminByIdAsync(id);
                if (ev == null) return null;

                if (!await HasTOAccessToEvent(updatedBy, ev))
                    throw new UnauthorizedAccessException("You do not have access to this event.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Only SuperAdmin or TouristOrganization can update events.");
            }

            var target = await _eventRepo.GetAdminByIdAsync(id);
            if (target == null) return null;

            if (dto.Name          != null) target.Name          = dto.Name;
            if (dto.Slug          != null) target.Slug          = dto.Slug;
            if (dto.Description   != null) target.Description   = dto.Description;
            if (dto.TypeId        != null) target.TypeId        = dto.TypeId.Value;
            if (dto.StartDatetime != null) target.StartDatetime = dto.StartDatetime.Value;
            if (dto.EndDatetime   != null) target.EndDatetime   = dto.EndDatetime.Value;
            if (dto.Price         != null) target.Price         = dto.Price;
            if (dto.Address       != null) target.Address       = dto.Address;
            if (dto.Latitude      != null) target.Latitude      = dto.Latitude;
            if (dto.Longitude     != null) target.Longitude     = dto.Longitude;
            if (dto.TicketUrl     != null) target.TicketUrl     = dto.TicketUrl;
            if (dto.CityId        != null) target.CityId        = dto.CityId;
            if (dto.CountryId     != null) target.CountryId     = dto.CountryId;
            if (dto.DestinationId != null) target.DestinationId = dto.DestinationId;
            if (dto.PlaceId       != null) target.PlaceId       = dto.PlaceId;
            if (dto.IsFeatured    != null) target.IsFeatured    = dto.IsFeatured.Value;
            if (dto.ExtraFilters  != null) target.ExtraFilters  = JsonSerializer.Serialize(dto.ExtraFilters);

            target.UpdatedAt = DateTimeOffset.UtcNow;
            target.UpdatedBy = updatedBy;

            _eventRepo.Update(target);
            await _eventRepo.SaveChangesAsync();

            var updated = await _eventRepo.GetAdminByIdAsync(id);
            return MapToDetailDto(updated!);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can delete events.");

            var ev = await _eventRepo.GetAdminByIdAsync(id);
            if (ev == null) return false;

            ev.IsDeleted = true;
            ev.DeletedAt = DateTimeOffset.UtcNow;

            _eventRepo.Update(ev);
            await _eventRepo.SaveChangesAsync();

            return true;
        }

        // ---- Helpers ----

        private async Task<bool> HasTOAccessToEvent(Guid userId, Event ev)
        {
            if (ev.DestinationId.HasValue)
            {
                var hasDestinationAccess = await _assignmentRepo.ExistsAsync(userId, ev.DestinationId.Value);
                if (hasDestinationAccess) return true;
            }

            if (ev.CityId.HasValue)
            {
                var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
                var destinationIds = assignments.Select(a => a.DestinationId).ToList();
                var cityIds = await _destinationRepo.GetCityIdsByDestinationsAsync(destinationIds);
                if (cityIds.Contains(ev.CityId.Value)) return true;
            }

            return false;
        }

        private static AdminEventListDto MapToListDto(Event e) => new()
        {
            Id             = e.Id,
            Name           = e.Name,
            Slug           = e.Slug,
            PreviewImageUrl= e.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.ImageUrl,
            Type           = e.Type?.Name,
            City           = e.City?.Name,
            Destination    = e.Destination?.Name,
            StartDatetime  = e.StartDatetime,
            EndDatetime    = e.EndDatetime,
            Price          = e.Price,
            AvgRating      = e.AvgRating,
            IsFeatured     = e.IsFeatured,
            CreatedAt      = e.CreatedAt,
            UpdatedAt      = e.UpdatedAt
        };

        private static AdminEventDetailDto MapToDetailDto(Event e) => new()
        {
            Id             = e.Id,
            Name           = e.Name,
            Slug           = e.Slug,
            Description    = e.Description,
            TypeId         = e.TypeId,
            Type           = e.Type?.Name,
            CityId         = e.CityId,
            City           = e.City?.Name,
            CountryId      = e.CountryId,
            Country        = e.Country?.Name,
            DestinationId  = e.DestinationId,
            Destination    = e.Destination?.Name,
            PlaceId        = e.PlaceId,
            Place          = e.Place?.Name,
            StartDatetime  = e.StartDatetime,
            EndDatetime    = e.EndDatetime,
            Price          = e.Price,
            Address        = e.Address,
            Latitude       = e.Latitude,
            Longitude      = e.Longitude,
            TicketUrl      = e.TicketUrl,
            AvgRating      = e.AvgRating,
            Popularity     = e.Popularity,
            IsFeatured     = e.IsFeatured,
            Images         = e.Images.OrderBy(i => i.SortOrder)
                                .Select(i => new AdminEventImageDto { Id = i.Id, ImageUrl = i.ImageUrl, SortOrder = i.SortOrder })
                                .ToList(),
            CreatedAt      = e.CreatedAt,
            UpdatedAt      = e.UpdatedAt,
            ExtraFilters   = string.IsNullOrEmpty(e.ExtraFilters)
                               ? null
                               : JsonSerializer.Deserialize<Dictionary<string, string>>(e.ExtraFilters)
        };

  }
}
