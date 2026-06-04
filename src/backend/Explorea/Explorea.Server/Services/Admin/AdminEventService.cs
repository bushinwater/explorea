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
            var currentUser = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (currentUser?.Role.Name == RoleNames.PlaceOwner)
            {
                return await GetOwnerStatsDtoAsync(currentUserId);
            }

            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);
            
            var activeCount = await _eventRepo.CountActiveAsync(
                restrictToDestinationIds,
                restrictToCityIds
            );

            var pendingCount = await _queueRepo.CountAsync(
                entityType: "event",
                statuses: new[] { "Pending", "ApprovedByTO" },
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
            int page, int pageSize, Guid currentUserId,
            string? sortBy = null)
        {
            var currentUser = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (currentUser?.Role.Name == RoleNames.PlaceOwner)
            {
                return await GetOwnerEventsAsync(
                    search,
                    destinationId,
                    cityId,
                    typeId,
                    startFrom,
                    startTo,
                    extraFilters,
                    page,
                    pageSize,
                    currentUserId,
                    sortBy);
            }

            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);

            var (items, total) = await _eventRepo.GetAdminPagedAsync(
                search,
                destinationId, cityId, typeId,
                startFrom, startTo,
                extraFilters,
                restrictToDestinationIds, restrictToCityIds,
                page, pageSize, sortBy);

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
            var currentUser = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (currentUser?.Role.Name == RoleNames.PlaceOwner)
            {
                return await GetOwnerDeletedEventsAsync(
                    search,
                    destinationId,
                    cityId,
                    typeId,
                    page,
                    pageSize,
                    currentUserId);
            }

            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);

            var query = _db.Events
                .IgnoreQueryFilters()
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Destination).ThenInclude(d => d!.City)
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

        public async Task<(List<AdminEventListDto> Items, int Total)> GetRejectedAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            int page,
            int pageSize,
            Guid currentUserId)
        {
            var currentUser = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (currentUser?.Role.Name == RoleNames.PlaceOwner)
            {
                var query = BuildOwnerEventScope(currentUserId)
                    .Where(e => !e.IsDeleted && e.Visibility == "rejected");

                query = ApplyOwnerEventFilters(query, search, destinationId, cityId, typeId, null, null);
                query = IncludeEventRelations(query);

                var ownerTotal = await query.CountAsync();
                var ownerItems = await query
                    .OrderByDescending(e => e.UpdatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return (ownerItems.Select(MapToListDto).ToList(), ownerTotal);
            }

            var (restrictToDestinationIds, restrictToCityIds) =
                await GetAccessRestrictionsAsync(currentUserId);

            var evQuery = _db.Events
                .IgnoreQueryFilters()
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Destination).ThenInclude(d => d!.City)
                .Include(e => e.Images)
                .Where(e => !e.IsDeleted && e.Visibility == "rejected")
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                evQuery = evQuery.Where(e =>
                    e.Name.ToLower().Contains(term) ||
                    (e.Description != null && e.Description.ToLower().Contains(term)) ||
                    (e.City != null && e.City.Name.ToLower().Contains(term)) ||
                    (e.Destination != null && e.Destination.Name.ToLower().Contains(term)));
            }

            if (destinationId.HasValue)
                evQuery = evQuery.Where(e => e.DestinationId == destinationId.Value);

            if (cityId.HasValue)
                evQuery = evQuery.Where(e => e.CityId == cityId.Value);

            if (typeId.HasValue)
                evQuery = evQuery.Where(e => e.TypeId == typeId.Value);

            if (restrictToDestinationIds != null || restrictToCityIds != null)
            {
                evQuery = evQuery.Where(e =>
                    (restrictToDestinationIds != null && e.DestinationId.HasValue && restrictToDestinationIds.Contains(e.DestinationId.Value)) ||
                    (restrictToCityIds != null && e.CityId.HasValue && restrictToCityIds.Contains(e.CityId.Value)));
            }

            var total = await evQuery.CountAsync();
            var items = await evQuery
                .OrderByDescending(e => e.UpdatedAt)
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

                if (!await HasTOAccessToEvent(currentUserId, user.ManagedRegionId, ev))
                    return null;

                return MapToDetailDto(ev);
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                var ev = await _eventRepo.GetAdminByIdAsync(id);
                if (ev == null) return null;

                return await EventBelongsToOwnerAsync(currentUserId, ev)
                    ? MapToDetailDto(ev)
                    : null;
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
            if (user?.Role.Name != RoleNames.SuperAdmin &&
                user?.Role.Name != RoleNames.TouristOrganization &&
                user?.Role.Name != RoleNames.PlaceOwner)
            {
                throw new UnauthorizedAccessException("Only SuperAdmin, TouristOrganization and PlaceOwner can create events.");
            }

            Place? linkedPlace = null;

            if (dto.PlaceId.HasValue)
            {
                linkedPlace = await _db.Places
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(place => place.Id == dto.PlaceId.Value && !place.IsDeleted);
            }

            var resolvedDestinationId = dto.DestinationId ?? linkedPlace?.DestinationId;

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                if (!resolvedDestinationId.HasValue)
                    throw new UnauthorizedAccessException("Destination is required for owner event submissions.");
            }
            var now = DateTimeOffset.UtcNow;
            var visibility = user.Role.Name == RoleNames.PlaceOwner ? "pending" : "published";

            int? resolvedCityId = dto.CityId;
            if (!resolvedCityId.HasValue && resolvedDestinationId.HasValue)
            {
                resolvedCityId = await _db.Destinations
                    .Where(d => d.Id == resolvedDestinationId.Value)
                    .Select(d => (int?)d.CityId)
                    .FirstOrDefaultAsync();
            }

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
                CityId        = resolvedCityId,
                CountryId     = dto.CountryId,
                DestinationId = resolvedDestinationId,
                PlaceId       = dto.PlaceId,
                IsFeatured    = dto.IsFeatured,
                ExtraFilters  = dto.ExtraFilters != null ? JsonSerializer.Serialize(dto.ExtraFilters) : null,
                Visibility     = visibility,
                CreatedAt     = now,
                UpdatedAt     = now,
                CreatedBy     = createdBy,
                UpdatedBy     = createdBy
            };

            await _eventRepo.AddAsync(ev);

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                await _queueRepo.AddAsync(new SubmissionQueue
                {
                    Id = Guid.NewGuid(),
                    EntityType = "event",
                    EntityId = ev.Id,
                    DestinationId = ev.DestinationId!.Value,
                    LinkedPlaceId = ev.PlaceId,
                    Status = "Pending",
                    SubmittedByUserId = createdBy,
                    SubmittedAt = now,
                    RequestPayload = JsonSerializer.Serialize(new
                    {
                        ev.Name,
                        ev.Description,
                        ev.Address,
                        ev.StartDatetime,
                        ev.EndDatetime,
                        ev.Price,
                        ev.TicketUrl,
                        ev.CityId,
                        ev.CountryId,
                        ev.DestinationId,
                        ev.PlaceId,
                        ev.ExtraFilters
                    })
                });
            }

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

                if (!await HasTOAccessToEvent(updatedBy, user.ManagedRegionId, ev))
                    throw new UnauthorizedAccessException("You do not have access to this event.");
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                var ev = await _eventRepo.GetAdminByIdAsync(id);
                if (ev == null) return null;

                var ownsEvent = ev.CreatedBy == updatedBy ||
                    (ev.PlaceId.HasValue && await _db.Places
                        .IgnoreQueryFilters()
                        .AnyAsync(p => p.Id == ev.PlaceId.Value && p.CreatedBy == updatedBy));
                if (!ownsEvent)
                    throw new UnauthorizedAccessException("Možete menjati samo sopstvene događaje.");
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
            if (dto.DestinationId != null)
            {
                AddChangedField(changedFields, "destinacija", target.DestinationId, dto.DestinationId);
                target.DestinationId = dto.DestinationId;
                var destCityId = await _db.Destinations
                    .Where(d => d.Id == dto.DestinationId.Value)
                    .Select(d => (int?)d.CityId)
                    .FirstOrDefaultAsync();
                if (destCityId.HasValue) target.CityId = destCityId;
            }
            if (dto.PlaceId != target.PlaceId) { AddChangedField(changedFields, "objekat", target.PlaceId, dto.PlaceId); target.PlaceId = dto.PlaceId; }
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

            var ev = await _eventRepo.GetAdminByIdAsync(id);

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (ev == null) return false;
                var ownsEvent = ev.CreatedBy == currentUserId ||
                    (ev.PlaceId.HasValue && await _db.Places
                        .IgnoreQueryFilters()
                        .AnyAsync(p => p.Id == ev.PlaceId.Value && p.CreatedBy == currentUserId));
                if (!ownsEvent)
                    throw new UnauthorizedAccessException("Možete obrisati samo sopstvene događaje.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (ev == null) return false;
                if (!await HasTOAccessToEvent(currentUserId, user.ManagedRegionId, ev))
                    throw new UnauthorizedAccessException("Nemate pristup ovom događaju.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Nemate dozvolu za brisanje događaja.");
            }
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
            var ev = await _eventRepo.GetAdminByIdAsync(id);
            if (ev == null || !ev.IsDeleted) return false;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                var ownsEvent = ev.CreatedBy == currentUserId ||
                    (ev.PlaceId.HasValue && await _db.Places
                        .IgnoreQueryFilters()
                        .AnyAsync(p => p.Id == ev.PlaceId.Value && p.CreatedBy == currentUserId));
                if (!ownsEvent)
                    throw new UnauthorizedAccessException("Možete vratiti samo sopstvene događaje.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!await HasTOAccessToEvent(currentUserId, user.ManagedRegionId, ev))
                    throw new UnauthorizedAccessException("Nemate pristup ovom događaju.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Nemate dozvolu za vraćanje obrisanih događaja.");
            }

            ev.IsDeleted = false;
            ev.DeletedAt = null;
            ev.UpdatedAt = DateTimeOffset.UtcNow;
            ev.UpdatedBy = currentUserId;

            _eventRepo.Update(ev);

            // If event was pending and queue item was deleted with it, recreate it
            if ((ev.Visibility == "pending" || ev.Visibility == "rejected") && ev.DestinationId.HasValue)
            {
                var existingQueue = await _db.SubmissionQueue
                    .FirstOrDefaultAsync(q => q.EntityId == ev.Id && q.EntityType == "event");

                if (existingQueue == null)
                {
                    await _db.SubmissionQueue.AddAsync(new Explorea.API.Models.SubmissionQueue
                    {
                        Id               = Guid.NewGuid(),
                        EntityType       = "event",
                        EntityId         = ev.Id,
                        DestinationId    = ev.DestinationId!.Value,
                        LinkedPlaceId    = ev.PlaceId,
                        Status           = ev.Visibility == "pending" ? "Pending" : "RejectedByTO",
                        SubmittedByUserId = ev.CreatedBy ?? currentUserId,
                        SubmittedAt      = DateTimeOffset.UtcNow,
                        RequestPayload   = "{}"
                    });
                }
            }

            await _eventRepo.SaveChangesAsync();

            return true;
        }

        public async Task ReactivateAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var ev = await _eventRepo.GetAdminByIdAsync(id)
                ?? throw new Exception("Događaj nije pronađen.");

            if (ev.Visibility != "rejected")
                throw new Exception("Samo odbijeni događaji mogu biti reaktivirani.");

            if (user?.Role.Name == RoleNames.TouristOrganization &&
                !await HasTOAccessToEvent(currentUserId, user.ManagedRegionId, ev))
                throw new UnauthorizedAccessException("Nemate pristup ovom događaju.");

            ev.Visibility = "published";
            ev.UpdatedAt  = DateTimeOffset.UtcNow;
            ev.UpdatedBy  = currentUserId;

            var queueItem = await _db.SubmissionQueue
                .Include(q => q.SubmittedByUser)
                .Include(q => q.Destination)
                .FirstOrDefaultAsync(q => q.EntityId == id && q.EntityType == "event");

            if (queueItem != null)
            {
                queueItem.Status             = "ApprovedByTO";
                queueItem.ReviewedByTOUserId = currentUserId;
                queueItem.ReviewedByTOAt     = DateTimeOffset.UtcNow;
                queueItem.RejectionReason    = null;
            }

            await _eventRepo.SaveChangesAsync();
        }

        public async Task ReforwardAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var ev = await _eventRepo.GetAdminByIdAsync(id)
                ?? throw new Exception("Događaj nije pronađen.");

            if (ev.Visibility != "rejected")
                throw new Exception("Samo odbijeni događaji mogu biti prosleđeni.");

            if (!ev.PlaceId.HasValue)
                throw new Exception("Ovaj događaj nije vezan za konkretan objekat.");

            if (user?.Role.Name == RoleNames.TouristOrganization &&
                !await HasTOAccessToEvent(currentUserId, user.ManagedRegionId, ev))
                throw new UnauthorizedAccessException("Nemate pristup ovom događaju.");

            ev.Visibility = "pending";
            ev.UpdatedAt  = DateTimeOffset.UtcNow;
            ev.UpdatedBy  = currentUserId;

            var queueItem = await _db.SubmissionQueue
                .FirstOrDefaultAsync(q => q.EntityId == id && q.EntityType == "event");

            if (queueItem != null)
            {
                queueItem.Status             = "ApprovedByTO";
                queueItem.ReviewedByTOUserId = currentUserId;
                queueItem.ReviewedByTOAt     = DateTimeOffset.UtcNow;
                queueItem.RejectionReason    = null;
                queueItem.LinkedPlaceId      = ev.PlaceId;
            }

            await _eventRepo.SaveChangesAsync();
        }

        // ---- Helpers ----

        private async Task<AdminEventStatsDto> GetOwnerStatsDtoAsync(Guid ownerId)
        {
            var activeCount = await BuildOwnerEventScope(ownerId)
                .Where(e => !e.IsDeleted && e.Visibility == "published")
                .CountAsync();

            var ownedPlaceIds = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => p.CreatedBy == ownerId)
                .Select(p => p.Id)
                .ToListAsync();

            var pendingCount = await _db.SubmissionQueue.CountAsync(q =>
                q.EntityType == "event" &&
                (q.SubmittedByUserId == ownerId && q.Status == "Pending") ||
                (q.Status == "ApprovedByTO" && q.LinkedPlaceId != null && ownedPlaceIds.Contains(q.LinkedPlaceId!.Value)));

            var rejectedCount = await _db.SubmissionQueue.CountAsync(q =>
                q.EntityType == "event" &&
                q.SubmittedByUserId == ownerId &&
                (q.Status == "RejectedByTO" || q.Status == "RejectedByOwner"));

            var now = DateTimeOffset.UtcNow;
            var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

            var approvedThisMonth = await _db.SubmissionQueue.CountAsync(q =>
                q.EntityType == "event" &&
                q.SubmittedByUserId == ownerId &&
                (q.Status == "ApprovedByTO" || q.Status == "ApprovedByOwner") &&
                q.ReviewedByTOAt >= monthStart);

            return new AdminEventStatsDto
            {
                ActiveRequests = activeCount,
                ActiveRequestsTrend = string.Empty,
                PendingApproval = pendingCount,
                PendingApprovalHint = "Zahtevi na cekanju",
                ApprovedThisMonth = approvedThisMonth,
                ApprovedThisMonthTrend = "Odobreno ovog meseca",
                Rejected = rejectedCount,
                RejectedNote = "Odbijeni zahtevi",
                TabPendingCount = pendingCount,
                TabActiveCount = activeCount
            };
        }

        private async Task<(List<AdminEventListDto> Items, int Total)> GetOwnerEventsAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            DateTimeOffset? startFrom,
            DateTimeOffset? startTo,
            List<string>? extraFilters,
            int page,
            int pageSize,
            Guid ownerId,
            string? sortBy)
        {
            var query = BuildOwnerEventScope(ownerId)
                .Where(e => !e.IsDeleted && e.Visibility == "published");

            query = ApplyOwnerEventFilters(query, search, destinationId, cityId, typeId, startFrom, startTo);
            query = IncludeEventRelations(query);

            var ordered = sortBy?.Trim().ToLower() switch
            {
                "updatedat_desc" => query.OrderByDescending(e => e.UpdatedAt),
                "updatedat_asc"  => query.OrderBy(e => e.UpdatedAt),
                _                => query.OrderByDescending(e => e.StartDatetime),
            };

            var items = await ordered.ToListAsync();
            if (extraFilters?.Count > 0)
            {
                items = items.Where(e => MatchesExtraFilters(e, extraFilters)).ToList();
            }

            var total = items.Count;
            var paged = items
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(MapToListDto)
                .ToList();

            return (paged, total);
        }

        private async Task<(List<AdminEventListDto> Items, int Total)> GetOwnerDeletedEventsAsync(
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            int page,
            int pageSize,
            Guid ownerId)
        {
            var query = BuildOwnerEventScope(ownerId)
                .Where(e => e.IsDeleted);

            query = ApplyOwnerEventFilters(query, search, destinationId, cityId, typeId, null, null);
            query = IncludeEventRelations(query);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.DeletedAt ?? e.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items.Select(MapToListDto).ToList(), total);
        }

        private IQueryable<Event> BuildOwnerEventScope(Guid ownerId)
        {
            // Owner only sees events they personally submitted, not all events on their venues
            return _db.Events
                .IgnoreQueryFilters()
                .Where(e => e.CreatedBy == ownerId);
        }

        private static IQueryable<Event> ApplyOwnerEventFilters(
            IQueryable<Event> query,
            string? search,
            Guid? destinationId,
            int? cityId,
            int? typeId,
            DateTimeOffset? startFrom,
            DateTimeOffset? startTo)
        {
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

            if (startFrom.HasValue)
                query = query.Where(e => e.StartDatetime >= startFrom.Value);

            if (startTo.HasValue)
                query = query.Where(e => e.StartDatetime <= startTo.Value);

            return query;
        }

        private static IQueryable<Event> IncludeEventRelations(IQueryable<Event> query)
        {
            return query
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Destination).ThenInclude(d => d!.City)
                .Include(e => e.Images);
        }

        private async Task<bool> EventBelongsToOwnerAsync(Guid ownerId, Event ev)
        {
            if (ev.CreatedBy == ownerId) return true;
            if (!ev.PlaceId.HasValue) return false;

            return await _db.Places
                .IgnoreQueryFilters()
                .AnyAsync(place => place.Id == ev.PlaceId.Value && !place.IsDeleted && place.CreatedBy == ownerId);
        }

        private static bool MatchesExtraFilters(Event ev, List<string> rawFilters)
        {
            var requested = ParseExtraFilters(rawFilters);
            if (requested.Count == 0) return true;
            if (string.IsNullOrWhiteSpace(ev.ExtraFilters)) return false;

            Dictionary<string, string>? stored;
            try
            {
                stored = JsonSerializer.Deserialize<Dictionary<string, string>>(ev.ExtraFilters);
            }
            catch (JsonException)
            {
                return false;
            }

            if (stored == null) return false;

            return requested.All(filter =>
                stored.TryGetValue(filter.Key, out var value) &&
                string.Equals(value, filter.Value, StringComparison.OrdinalIgnoreCase));
        }

        private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
        {
            var dict = new Dictionary<string, string>();
            if (raw == null) return dict;

            foreach (var entry in raw)
            {
                var idx = entry.IndexOf(':');
                if (idx > 0)
                    dict[entry[..idx]] = entry[(idx + 1)..];
            }

            return dict;
        }

        private async Task<bool> HasTOAccessToEvent(Guid userId, int? managedRegionId, Event ev)
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

            if (managedRegionId.HasValue)
            {
                if (ev.DestinationId.HasValue)
                {
                    var inRegion = await _db.Destinations
                        .IgnoreQueryFilters()
                        .AnyAsync(d => d.Id == ev.DestinationId.Value && !d.IsDeleted
                            && d.City != null && d.City.RegionId == managedRegionId.Value);
                    if (inRegion) return true;
                }
                if (ev.CityId.HasValue)
                {
                    var inRegion = await _db.Cities
                        .AnyAsync(c => c.Id == ev.CityId.Value && c.RegionId == managedRegionId.Value);
                    if (inRegion) return true;
                }
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
            if (oldValue is string || newValue is string)
            {
                var oldNormalized = string.IsNullOrWhiteSpace(oldValue as string) ? string.Empty : ((string)(object)oldValue!).Trim();
                var newNormalized = string.IsNullOrWhiteSpace(newValue as string) ? string.Empty : ((string)(object)newValue!).Trim();
                if (!string.Equals(oldNormalized, newNormalized, StringComparison.Ordinal))
                {
                    fields.Add(label);
                }
                return;
            }

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
            Address        = e.Address,
            City           = e.City?.Name ?? e.Destination?.City?.Name,
            Destination    = e.Destination?.Name,
            DestinationId  = e.DestinationId,
            PlaceId        = e.PlaceId,
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
