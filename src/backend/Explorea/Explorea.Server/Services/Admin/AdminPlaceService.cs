using System.Text.Json;
using Explorea.API.DTOs.Admin.Place;
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
    public class AdminPlaceService : IAdminPlaceService
    {
        private readonly IAdminPlaceRepository _placeRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISubmissionQueueRepository _queueRepo;
        private readonly AppDbContext _context;
        private readonly ISavedItemCleanupService _savedItemCleanup;
        private readonly IOwnerChangeNotificationService _ownerChangeNotifications;
        private readonly IEmailService _emailService;
        private readonly ILogger<AdminPlaceService> _logger;

        private static readonly GeometryFactory _geometryFactory =
            new GeometryFactory(new PrecisionModel(), 4326);

        public AdminPlaceService(
            IAdminPlaceRepository placeRepo,
            IUserRepository userRepo,
            ISubmissionQueueRepository queueRepo,
            AppDbContext context,
            ISavedItemCleanupService savedItemCleanup,
            IOwnerChangeNotificationService ownerChangeNotifications,
            IEmailService emailService,
            ILogger<AdminPlaceService> logger)
        {
            _placeRepo = placeRepo;
            _userRepo = userRepo;
            _queueRepo = queueRepo;
            _context = context;
            _savedItemCleanup = savedItemCleanup;
            _ownerChangeNotifications = ownerChangeNotifications;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<(List<AdminPlaceListDto> Items, int Total)> GetAllAsync(
            AdminPlaceListQueryDto query, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            Guid? restrictToOwner = null;
            int? restrictToRegionId = null;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                restrictToOwner = currentUserId;
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue)
                    return (new List<AdminPlaceListDto>(), 0);
                restrictToRegionId = user.ManagedRegionId.Value;
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var filterRegionId = (user?.Role.Name == RoleNames.PlaceOwner) ? null : query.Region;

            var (items, total) = await _placeRepo.GetAdminPagedAsync(
                query.Search,
                query.TypeId,
                query.Status,
                filterRegionId,
                query.MinRating,
                query.DestinationId,
                query.AmenityId,
                restrictToOwner,
                restrictToRegionId,
                query.Page,
                query.PageSize,
                query.SortBy);

            var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);
            var pageIds = items.Select(p => p.Id).ToList();
            var recentlyActiveIds = (await _context.PopularityLogs
                .Where(l => l.EntityType == "place" && pageIds.Contains(l.EntityId) && l.CreatedAt >= thirtyDaysAgo)
                .Select(l => l.EntityId)
                .Distinct()
                .ToListAsync())
                .ToHashSet();

            return (items.Select(p => MapToListDto(p, recentlyActiveIds)).ToList(), total);
        }

        public async Task<(List<AdminPlaceListDto> Items, int Total)> GetDeletedAsync(
            AdminPlaceListQueryDto query, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            var placesQuery = _context.Places
                .IgnoreQueryFilters()
                .Include(p => p.Images)
                .Include(p => p.Type)
                .Include(p => p.City)
                    .ThenInclude(c => c!.Region)
                .Include(p => p.Destination)
                .Where(p => p.IsDeleted)
                .AsQueryable();

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                placesQuery = placesQuery.Where(p => p.CreatedBy == currentUserId);
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue)
                    return (new List<AdminPlaceListDto>(), 0);

                placesQuery = placesQuery.Where(p => p.City != null && p.City.RegionId == user.ManagedRegionId.Value);
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var s = query.Search.Trim().ToLower();
                placesQuery = placesQuery.Where(p => p.Name.ToLower().Contains(s));
            }

            if (query.TypeId.HasValue)
                placesQuery = placesQuery.Where(p => p.TypeId == query.TypeId.Value);

            if (query.Region.HasValue && user?.Role.Name != RoleNames.PlaceOwner)
                placesQuery = placesQuery.Where(p => p.City != null && p.City.RegionId == query.Region.Value);

            if (query.MinRating.HasValue)
                placesQuery = placesQuery.Where(p => p.AvgRating >= query.MinRating.Value);

            if (query.DestinationId.HasValue)
                placesQuery = placesQuery.Where(p => p.DestinationId == query.DestinationId.Value);

            if (query.AmenityId.HasValue)
                placesQuery = placesQuery.Where(p => p.AmenityLinks.Any(al => al.AmenityId == query.AmenityId.Value));

            var total = await placesQuery.CountAsync();

            var items = await placesQuery
                .OrderByDescending(p => p.DeletedAt ?? p.UpdatedAt)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync();

            return (items.Select(p => MapToListDto(p)).ToList(), total);
        }

        public async Task<AdminPlaceStatsDto> GetStatsAsync(Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            var query = _context.Places.AsQueryable();

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                query = query.Where(p => p.CreatedBy == currentUserId);
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue)
                    return new AdminPlaceStatsDto();
                query = query.Where(p => p.City != null && p.City.RegionId == user.ManagedRegionId.Value);
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);

            var totalCount = await query.CountAsync();
            var activeCount = await query.CountAsync(p => p.ApprovalStatus == "approved");
            var pendingCount = await query.CountAsync(p => p.ApprovalStatus == "pending");
            var inactiveCount = await query.CountAsync(p => p.ApprovalStatus == "rejected");
            var addedLast30Days = await query.CountAsync(p => p.CreatedAt >= thirtyDaysAgo);

            var topPlaces = await query
                .OrderByDescending(p => p.AvgRating)
                .Take(5)
                .Select(p => new { p.Id, p.Name, p.AvgRating })
                .ToListAsync();

            var placeIds = topPlaces.Select(p => p.Id).ToList();
            var reviewCounts = await _context.Reviews
                .Where(r => r.EntityType == "place" && placeIds.Contains(r.EntityId) && !r.IsDeleted)
                .GroupBy(r => r.EntityId)
                .Select(g => new { EntityId = g.Key, Count = g.Count() })
                .ToListAsync();

            var reviewCountDict = reviewCounts.ToDictionary(r => r.EntityId, r => r.Count);

            return new AdminPlaceStatsDto
            {
                TotalCount = totalCount,
                ActiveCount = activeCount,
                PendingCount = pendingCount,
                InactiveCount = inactiveCount,
                AddedLast30Days = addedLast30Days,
                TopPlaces = topPlaces.Select(p => new AdminPlaceTopItemDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    AvgRating = p.AvgRating,
                    ReviewCount = reviewCountDict.GetValueOrDefault(p.Id, 0)
                }).ToList()
            };
        }

        public async Task<AdminPlaceDetailDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var place = await _placeRepo.GetAdminByIdAsync(id);

            if (place == null) return null;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (place.CreatedBy != currentUserId)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    place.City?.RegionId != user.ManagedRegionId.Value)
                    return null;
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            return MapToDetailDto(place);
        }

        public async Task<AdminPlaceDetailDto> CreateAsync(AdminCreatePlaceDto dto, Guid createdBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(createdBy);

            string approvalStatus;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (!dto.DestinationId.HasValue)
                    throw new UnauthorizedAccessException("Destination is required for owner place submissions.");

                approvalStatus = "pending";
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue)
                    throw new UnauthorizedAccessException("Tourist Organization has no managed region.");
                approvalStatus = "approved";
            }
            else if (user?.Role.Name == RoleNames.SuperAdmin)
            {
                approvalStatus = "approved";
            }
            else
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var now = DateTimeOffset.UtcNow;

            var place = new Place
            {
                Id = Guid.NewGuid(),
                DestinationId = dto.DestinationId,
                CityId = dto.CityId,
                CountryId = dto.CountryId,
                TypeId = dto.TypeId,
                Name = dto.Name,
                Slug = dto.Slug,
                Description = dto.Description,
                Address = dto.Address,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Location = CreatePoint(dto.Latitude, dto.Longitude),
                PriceRange = dto.PriceRange,
                Phone = dto.Phone,
                Email = dto.Email,
                WebsiteUrl = dto.WebsiteUrl,
                IsFeatured = dto.IsFeatured,
                ExtraFilters = dto.ExtraFilters != null ? JsonSerializer.Serialize(dto.ExtraFilters) : null,
                ApprovalStatus = approvalStatus,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = createdBy,
                UpdatedBy = createdBy
            };

            foreach (var image in dto.Images)
            {
                place.Images.Add(new PlaceImage
                {
                    Id = Guid.NewGuid(),
                    PlaceId = place.Id,
                    ImageUrl = image.ImageUrl,
                    Caption = image.Caption,
                    SortOrder = image.SortOrder,
                    CreatedAt = now,
                    CreatedBy = createdBy,
                    UpdatedBy = createdBy
                });
            }

            foreach (var amenityId in dto.AmenityIds.Distinct())
            {
                place.AmenityLinks.Add(new PlaceAmenityLink
                {
                    PlaceId = place.Id,
                    AmenityId = amenityId
                });
            }

            foreach (var workingDay in dto.WorkingDays)
            {
                var workingDayEntity = new PlaceWorkingDay
                {
                    Id = Guid.NewGuid(),
                    PlaceId = place.Id,
                    DayOfWeek = workingDay.DayOfWeek,
                    IsClosed = workingDay.IsClosed,
                    Note = workingDay.Note,
                    CreatedAt = now,
                    UpdatedAt = now,
                    CreatedBy = createdBy,
                    UpdatedBy = createdBy
                };

                foreach (var interval in workingDay.Intervals)
                {
                    workingDayEntity.Intervals.Add(new PlaceWorkingHourInterval
                    {
                        Id = Guid.NewGuid(),
                        WorkingDayId = workingDayEntity.Id,
                        OpensAt = interval.OpensAt,
                        ClosesAt = interval.ClosesAt,
                        CreatedAt = now,
                        CreatedBy = createdBy,
                        UpdatedBy = createdBy
                    });
                }

                place.WorkingDays.Add(workingDayEntity);
            }

            await _placeRepo.AddAsync(place);
            await _placeRepo.SaveChangesAsync();

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                await _queueRepo.AddAsync(new SubmissionQueue
                {
                    Id = Guid.NewGuid(),
                    EntityType = "place",
                    EntityId = place.Id,
                    DestinationId = place.DestinationId!.Value,
                    Status = "Pending",
                    SubmittedByUserId = createdBy,
                    SubmittedAt = now,
                    RequestPayload = JsonSerializer.Serialize(new
                    {
                        place.Name,
                        place.Description,
                        place.Address,
                        place.Latitude,
                        place.Longitude,
                        place.PriceRange,
                        place.Phone,
                        place.Email,
                        place.WebsiteUrl,
                        place.TypeId,
                        place.CityId,
                        place.CountryId,
                        place.DestinationId,
                        place.ExtraFilters
                    })
                });

                await _queueRepo.SaveChangesAsync();
            }

            var created = await _placeRepo.GetAdminByIdAsync(place.Id);
            return MapToDetailDto(created!);
        }

        public async Task<AdminPlaceDetailDto?> UpdateAsync(Guid id, AdminUpdatePlaceDto dto, Guid updatedBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(updatedBy);
            var place = await _placeRepo.GetAdminByIdAsync(id);

            if (place == null) return null;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (place.CreatedBy != updatedBy)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    place.City?.RegionId != user.ManagedRegionId.Value)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var ownerId = place.CreatedBy;
            var previousApprovalStatus = place.ApprovalStatus;
            var changedFields = new List<string>();

            if (dto.Name != null) { AddChangedField(changedFields, "naslov", place.Name, dto.Name); place.Name = dto.Name; }
            if (dto.Slug != null) { AddChangedField(changedFields, "slug", place.Slug, dto.Slug); place.Slug = dto.Slug; }
            if (dto.Description != null) { AddChangedField(changedFields, "opis", place.Description, dto.Description); place.Description = dto.Description; }
            if (dto.Address != null) { AddChangedField(changedFields, "adresa", place.Address, dto.Address); place.Address = dto.Address; }
            if (dto.DestinationId.HasValue) { AddChangedField(changedFields, "destinacija", place.DestinationId, dto.DestinationId.Value); place.DestinationId = dto.DestinationId.Value; }
            if (dto.CityId.HasValue) { AddChangedField(changedFields, "grad", place.CityId, dto.CityId.Value); place.CityId = dto.CityId.Value; }
            if (dto.CountryId.HasValue) { AddChangedField(changedFields, "drzava", place.CountryId, dto.CountryId.Value); place.CountryId = dto.CountryId.Value; }
            if (dto.TypeId.HasValue) { AddChangedField(changedFields, "tip", place.TypeId, dto.TypeId.Value); place.TypeId = dto.TypeId.Value; }
            if (dto.PriceRange != null) { AddChangedField(changedFields, "cenovni rang", place.PriceRange, dto.PriceRange); place.PriceRange = dto.PriceRange; }
            if (dto.Phone != null) { AddChangedField(changedFields, "telefon", place.Phone, dto.Phone); place.Phone = dto.Phone; }
            if (dto.Email != null) { AddChangedField(changedFields, "email", place.Email, dto.Email); place.Email = dto.Email; }
            if (dto.WebsiteUrl != null) { AddChangedField(changedFields, "veb sajt", place.WebsiteUrl, dto.WebsiteUrl); place.WebsiteUrl = dto.WebsiteUrl; }
            if (dto.IsFeatured.HasValue) { AddChangedField(changedFields, "istaknuto", place.IsFeatured, dto.IsFeatured.Value); place.IsFeatured = dto.IsFeatured.Value; }

            // Only SA and TO can change approval status
            if (dto.ApprovalStatus != null &&
                user?.Role.Name != RoleNames.PlaceOwner)
            {
                var validStatuses = new[] { "approved", "pending", "rejected" };
                if (validStatuses.Contains(dto.ApprovalStatus.ToLowerInvariant()))
                {
                    var newStatus = dto.ApprovalStatus.ToLowerInvariant();
                    AddChangedField(changedFields, "status", place.ApprovalStatus, newStatus);
                    place.ApprovalStatus = newStatus;
                }
            }

            if (dto.Latitude.HasValue && dto.Longitude.HasValue)
            {
                if (place.Latitude != dto.Latitude.Value || place.Longitude != dto.Longitude.Value)
                {
                    changedFields.Add("koordinate");
                }

                place.Latitude = dto.Latitude.Value;
                place.Longitude = dto.Longitude.Value;
                place.Location = CreatePoint(dto.Latitude, dto.Longitude);
            }

            if (dto.Images != null)
            {
                changedFields.Add("slike");
                _placeRepo.RemoveImages(place.Images);

                var now = DateTimeOffset.UtcNow;
                place.Images = dto.Images.Select(x => new PlaceImage
                {
                    Id = Guid.NewGuid(),
                    PlaceId = place.Id,
                    ImageUrl = x.ImageUrl,
                    Caption = x.Caption,
                    SortOrder = x.SortOrder,
                    CreatedAt = now,
                    CreatedBy = place.CreatedBy,
                    UpdatedBy = updatedBy
                }).ToList();
            }

            if (dto.AmenityIds != null)
            {
                changedFields.Add("sadrzaji");
                _placeRepo.RemoveAmenityLinks(place.AmenityLinks);

                place.AmenityLinks = dto.AmenityIds
                    .Distinct()
                    .Select(amenityId => new PlaceAmenityLink
                    {
                        PlaceId = place.Id,
                        AmenityId = amenityId
                    })
                    .ToList();
            }

            if (dto.WorkingDays != null)
            {
                changedFields.Add("radno vreme");
                var newWorkingDays = new List<PlaceWorkingDay>();
                var now = DateTimeOffset.UtcNow;

                foreach (var wd in dto.WorkingDays)
                {
                    var dayId = Guid.NewGuid();

                    var day = new PlaceWorkingDay
                    {
                        Id = dayId,
                        PlaceId = place.Id,
                        DayOfWeek = wd.DayOfWeek,
                        IsClosed = wd.IsClosed,
                        Note = wd.Note,
                        CreatedAt = now,
                        UpdatedAt = now,
                        CreatedBy = place.CreatedBy,
                        UpdatedBy = updatedBy
                    };

                    foreach (var interval in wd.Intervals)
                    {
                        day.Intervals.Add(new PlaceWorkingHourInterval
                        {
                            Id = Guid.NewGuid(),
                            WorkingDayId = dayId,
                            OpensAt = interval.OpensAt,
                            ClosesAt = interval.ClosesAt,
                            CreatedAt = now,
                            CreatedBy = place.CreatedBy,
                            UpdatedBy = updatedBy
                        });
                    }

                    newWorkingDays.Add(day);
                }

                await _placeRepo.ReplaceWorkingDaysAsync(place.Id, newWorkingDays);
            }

            place.UpdatedAt = DateTimeOffset.UtcNow;
            place.UpdatedBy = updatedBy;

            _placeRepo.Update(place);
            await _placeRepo.SaveChangesAsync();

            if (previousApprovalStatus != place.ApprovalStatus &&
                (place.ApprovalStatus == "approved" || place.ApprovalStatus == "rejected"))
            {
                changedFields.Remove("status");
            }

            await NotifyOwnerAboutApprovalDecisionAsync(
                ownerId,
                place.Name,
                previousApprovalStatus,
                place.ApprovalStatus);

            await _ownerChangeNotifications.NotifyOwnerAsync(
                ownerId,
                "objekat",
                place.Name,
                user!,
                changedFields);

            var updated = await _placeRepo.GetAdminByIdAsync(id);
            return MapToDetailDto(updated!);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var place = await _placeRepo.GetAdminByIdAsync(id);

            if (place == null) return false;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (place.CreatedBy != currentUserId)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    place.City?.RegionId != user.ManagedRegionId.Value)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            place.IsDeleted = true;
            place.DeletedAt = DateTimeOffset.UtcNow;
            place.UpdatedAt = DateTimeOffset.UtcNow;
            place.UpdatedBy = currentUserId;

            _placeRepo.Update(place);
            await _placeRepo.SaveChangesAsync();
            await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync(
                "place",
                place.Id,
                place.Name);

            return true;
        }

        public async Task<bool> RestoreAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var place = await _placeRepo.GetAdminByIdAsync(id);

            if (place == null || !place.IsDeleted) return false;

            if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (place.CreatedBy != currentUserId)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!user.ManagedRegionId.HasValue ||
                    place.City?.RegionId != user.ManagedRegionId.Value)
                    throw new UnauthorizedAccessException("Access denied.");
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            place.IsDeleted = false;
            place.DeletedAt = null;
            place.UpdatedAt = DateTimeOffset.UtcNow;
            place.UpdatedBy = currentUserId;

            _placeRepo.Update(place);
            await _placeRepo.SaveChangesAsync();

            return true;
        }

        public async Task<List<AdminMyPlaceDto>> GetMyPlacesAsync(Guid currentUserId)
        {
            var places = await _placeRepo.GetMyPlacesAsync(currentUserId);

            return places.Select(p => new AdminMyPlaceDto
            {
                Id = p.Id,
                Name = p.Name,
                PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                AvgRating = p.AvgRating,
                Status = p.ApprovalStatus
            }).ToList();
        }

        public async Task SubmitPlaceRequestAsync(SubmitPlaceRequestDto dto, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.SuperAdmin || user?.Role.Name == RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Admins should create places directly, not through queue requests.");

            var payload = new PlaceRequestPayloadDto
            {
                Name = dto.Name,
                Description = dto.Description,
                Address = dto.Address,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Images = dto.Images ?? new List<string>(),
                Documents = dto.Documents ?? new List<string>(),
                TypeId = dto.TypeId,
                CityId = dto.CityId
            };

            var queueItem = new SubmissionQueue
            {
                Id = Guid.NewGuid(),
                EntityType = "place",
                EntityId = Guid.NewGuid(),
                DestinationId = dto.DestinationId,
                Status = "Pending",
                SubmittedByUserId = currentUserId,
                SubmittedAt = DateTimeOffset.UtcNow,
                RequestPayload = JsonSerializer.Serialize(payload)
            };

            await _queueRepo.AddAsync(queueItem);
            await _queueRepo.SaveChangesAsync();
        }

        private static Point CreatePoint(double? latitude, double? longitude)
        {
            var lng = longitude ?? 0;
            var lat = latitude ?? 0;
            return _geometryFactory.CreatePoint(new Coordinate(lng, lat));
        }

        private static AdminPlaceListDto MapToListDto(Place p, HashSet<Guid>? recentlyActiveIds = null) => new()
        {
            Id = p.Id,
            Name = p.Name,
            Slug = p.Slug,
            PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
            TypeId = p.TypeId,
            Type = p.Type?.Name,
            City = p.City?.Name,
            Region = p.City?.Region?.Name,
            Destination = p.Destination?.Name,
            AvgRating = p.AvgRating,
            IsFeatured = p.IsFeatured,
            HasRecentActivity = recentlyActiveIds?.Contains(p.Id) ?? false,
            Address = p.Address,
            Status = p.ApprovalStatus,
            CreatedBy = p.CreatedBy,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            DeletedAt = p.DeletedAt
        };

        private static AdminPlaceDetailDto MapToDetailDto(Place p) => new()
        {
            Id = p.Id,
            DestinationId = p.DestinationId,
            CityId = p.CityId,
            CountryId = p.CountryId,
            TypeId = p.TypeId,
            Name = p.Name,
            Slug = p.Slug,
            Description = p.Description,
            Address = p.Address,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            PriceRange = p.PriceRange,
            PricePerNight = p.PricePerNight,
            Phone = p.Phone,
            Email = p.Email,
            WebsiteUrl = p.WebsiteUrl,
            AvgRating = p.AvgRating,
            IsFeatured = p.IsFeatured,
            Status = p.ApprovalStatus,
            Type = p.Type?.Name,
            City = p.City?.Name,
            Region = p.City?.Region?.Name,
            Destination = p.Destination?.Name,
            Country = p.Country?.Name,
            ExtraFilters = p.ExtraFilters,
            CreatedBy = p.CreatedBy,
            Images = p.Images
                .OrderBy(i => i.SortOrder)
                .Select(i => new AdminPlaceImageDto
                {
                    Id = i.Id,
                    ImageUrl = i.ImageUrl,
                    Caption = i.Caption,
                    SortOrder = i.SortOrder
                })
                .ToList(),
            Amenities = p.AmenityLinks
                .Select(al => new AdminPlaceAmenityDto
                {
                    Id = al.AmenityId,
                    Name = al.Amenity.Name
                })
                .ToList(),
            WorkingDays = p.WorkingDays
                .OrderBy(wd => wd.DayOfWeek)
                .Select(wd => new AdminPlaceWorkingDayDto
                {
                    Id = wd.Id,
                    DayOfWeek = wd.DayOfWeek,
                    IsClosed = wd.IsClosed,
                    Note = wd.Note,
                    Intervals = wd.Intervals
                        .OrderBy(i => i.OpensAt)
                        .Select(i => new AdminPlaceWorkingHourIntervalDto
                        {
                            Id = i.Id,
                            OpensAt = i.OpensAt,
                            ClosesAt = i.ClosesAt
                        })
                        .ToList()
                })
                .ToList(),
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt
        };

        private static void AddChangedField<T>(ICollection<string> fields, string label, T oldValue, T newValue)
        {
            if (!EqualityComparer<T>.Default.Equals(oldValue, newValue))
            {
                fields.Add(label);
            }
        }

        private async Task NotifyOwnerAboutApprovalDecisionAsync(
            Guid? ownerId,
            string placeName,
            string previousStatus,
            string currentStatus)
        {
            if (!ownerId.HasValue ||
                previousStatus == currentStatus ||
                (currentStatus != "approved" && currentStatus != "rejected"))
            {
                return;
            }

            var owner = await _context.Users.FirstOrDefaultAsync(user => user.Id == ownerId.Value);
            if (string.IsNullOrWhiteSpace(owner?.Email))
                return;

            try
            {
                await _emailService.SendSubmittedEntityReviewedEmailAsync(
                    owner.Email,
                    owner.FirstName,
                    "objekat",
                    placeName,
                    currentStatus == "approved",
                    currentStatus == "rejected" ? "Objekat je odbijen od strane administratora." : null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to send place approval decision email to {Email} for place {PlaceName}.",
                    owner.Email,
                    placeName);
            }
        }
    }
}
