using System.Text.Json;
using Explorea.API.DTOs.Admin.Event;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

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
        private readonly AppDbContext _db;
        private readonly ISavedItemCleanupService _savedItemCleanup;
        private readonly IOwnerChangeNotificationService _ownerChangeNotifications;

        public AdminEventService(
            IAdminEventRepository eventRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IDestinationRepository destinationRepo,
            ISubmissionQueueRepository queueRepo,
            IUserRepository userRepo,
            ILookupRepository lookupRepo,
            AppDbContext db,
            ISavedItemCleanupService savedItemCleanup,
            IOwnerChangeNotificationService ownerChangeNotifications)
        {
            _eventRepo       = eventRepo;
            _assignmentRepo  = assignmentRepo;
            _destinationRepo = destinationRepo;
            _queueRepo       = queueRepo;
            _userRepo        = userRepo;
            _lookupRepo      = lookupRepo;
            _db              = db;
            _savedItemCleanup = savedItemCleanup;
            _ownerChangeNotifications = ownerChangeNotifications;
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

        public async Task<(List<AdminEventListDto> Items, int Total)> GetDeletedAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            int page,
            int pageSize,
            Guid currentUserId)
        {
            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);

            var query = _db.Events
                .IgnoreQueryFilters()
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Destination)
                .Include(e => e.Images)
                .Where(e => e.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(e =>
                    e.Name.ToLower().Contains(term) ||
                    (e.Description != null && e.Description.ToLower().Contains(term)) ||
                    (e.Address != null && e.Address.ToLower().Contains(term)) ||
                    (e.City != null && e.City.Name.ToLower().Contains(term)) ||
                    (e.Destination != null && e.Destination.Name.ToLower().Contains(term)) ||
                    (e.Type != null && e.Type.Name.ToLower().Contains(term)));
            }

            if (destinationId.HasValue)
                query = query.Where(e => e.DestinationId == destinationId.Value);

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId.Value);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId.Value);

            if (restrictToDestinationIds != null || restrictToCityIds != null)
            {
                query = query.Where(e =>
                    (restrictToDestinationIds != null && e.DestinationId.HasValue && restrictToDestinationIds.Contains(e.DestinationId.Value)) ||
                    (restrictToCityIds != null && e.CityId.HasValue && restrictToCityIds.Contains(e.CityId.Value)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.DeletedAt ?? e.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

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

            var ownerId = await ResolveEventOwnerIdAsync(target);
            var changedFields = new List<string>();

            if (dto.Name          != null) { AddChangedField(changedFields, "naslov", target.Name, dto.Name); target.Name = dto.Name; }
            if (dto.Slug          != null) { AddChangedField(changedFields, "slug", target.Slug, dto.Slug); target.Slug = dto.Slug; }
            if (dto.Description   != null) { AddChangedField(changedFields, "opis", target.Description, dto.Description); target.Description = dto.Description; }
            if (dto.TypeId        != null) { AddChangedField(changedFields, "tip", target.TypeId, dto.TypeId.Value); target.TypeId = dto.TypeId.Value; }
            if (dto.StartDatetime != null) { AddChangedField(changedFields, "pocetak", target.StartDatetime, dto.StartDatetime.Value); target.StartDatetime = dto.StartDatetime.Value; }
            if (dto.EndDatetime   != null) { AddChangedField(changedFields, "kraj", target.EndDatetime, dto.EndDatetime.Value); target.EndDatetime = dto.EndDatetime.Value; }
            if (dto.Price         != null) { AddChangedField(changedFields, "cena", target.Price, dto.Price); target.Price = dto.Price; }
            if (dto.Address       != null) { AddChangedField(changedFields, "adresa", target.Address, dto.Address); target.Address = dto.Address; }
            if (dto.Latitude != null || dto.Longitude != null)
            {
                if (target.Latitude != dto.Latitude || target.Longitude != dto.Longitude)
                    changedFields.Add("koordinate");
                if (dto.Latitude  != null) target.Latitude  = dto.Latitude;
                if (dto.Longitude != null) target.Longitude = dto.Longitude;
            }
            if (dto.TicketUrl     != null) { AddChangedField(changedFields, "link za karte", target.TicketUrl, dto.TicketUrl); target.TicketUrl = dto.TicketUrl; }
            if (dto.CityId        != null) { AddChangedField(changedFields, "grad", target.CityId, dto.CityId); target.CityId = dto.CityId; }
            if (dto.CountryId     != null) { AddChangedField(changedFields, "drzava", target.CountryId, dto.CountryId); target.CountryId = dto.CountryId; }
            if (dto.DestinationId != null) { AddChangedField(changedFields, "destinacija", target.DestinationId, dto.DestinationId); target.DestinationId = dto.DestinationId; }
            if (dto.PlaceId       != null) { AddChangedField(changedFields, "objekat", target.PlaceId, dto.PlaceId); target.PlaceId = dto.PlaceId; }
            if (dto.IsFeatured    != null) { AddChangedField(changedFields, "istaknuto", target.IsFeatured, dto.IsFeatured.Value); target.IsFeatured = dto.IsFeatured.Value; }
            if (dto.ExtraFilters  != null) target.ExtraFilters = JsonSerializer.Serialize(dto.ExtraFilters);

            target.UpdatedAt = DateTimeOffset.UtcNow;
            target.UpdatedBy = updatedBy;

            _eventRepo.Update(target);
            await _eventRepo.SaveChangesAsync();
            await _ownerChangeNotifications.NotifyOwnerAsync(
                ownerId,
                "dogadjaj",
                target.Name,
                user!,
                changedFields);

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
            ev.UpdatedAt = DateTimeOffset.UtcNow;
            ev.UpdatedBy = currentUserId;

            _eventRepo.Update(ev);
            await _eventRepo.SaveChangesAsync();
            await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync(
                "event",
                ev.Id,
                ev.Name);

            return true;
        }

        public async Task<bool> RestoreAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can restore events.");

            var ev = await _eventRepo.GetAdminByIdAsync(id);
            if (ev == null || !ev.IsDeleted) return false;

            ev.IsDeleted = false;
            ev.DeletedAt = null;
            ev.UpdatedAt = DateTimeOffset.UtcNow;
            ev.UpdatedBy = currentUserId;

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

        private async Task<Guid?> ResolveEventOwnerIdAsync(Event ev)
        {
            if (ev.PlaceId.HasValue)
            {
                return await _db.Places
                    .IgnoreQueryFilters()
                    .Where(place => place.Id == ev.PlaceId.Value)
                    .Select(place => place.CreatedBy)
                    .FirstOrDefaultAsync();
            }

            var createdByRole = await _db.Users
                .Include(user => user.Role)
                .Where(user => user.Id == ev.CreatedBy)
                .Select(user => user.Role.Name)
                .FirstOrDefaultAsync();

            return createdByRole == RoleNames.PlaceOwner ? ev.CreatedBy : null;
        }

        private static void AddChangedField<T>(ICollection<string> fields, string label, T oldValue, T newValue)
        {
            if (!EqualityComparer<T>.Default.Equals(oldValue, newValue))
            {
                fields.Add(label);
            }
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
            UpdatedAt      = e.UpdatedAt,
            DeletedAt      = e.DeletedAt
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
