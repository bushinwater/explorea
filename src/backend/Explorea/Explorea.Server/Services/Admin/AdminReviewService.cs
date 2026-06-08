using Explorea.API.DTOs.Admin.Review;
using Explorea.API.Models;
using Explorea.Server.Data;
using Activity = Explorea.API.Models.Activity;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminReviewService : IAdminReviewService
    {
        private readonly IAdminReviewRepository _reviewRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IDestinationRepository _destinationRepo;
        private readonly IUserRepository _userRepo;
        private readonly ILookupRepository _lookupRepo;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _config;
        private readonly AppDbContext _db;

        public AdminReviewService(
            IAdminReviewRepository reviewRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IDestinationRepository destinationRepo,
            IUserRepository userRepo,
            ILookupRepository lookupRepo,
            IEmailService emailService,
            IConfiguration config,
            AppDbContext db)
        {
            _reviewRepo      = reviewRepo;
            _assignmentRepo  = assignmentRepo;
            _destinationRepo = destinationRepo;
            _userRepo        = userRepo;
            _lookupRepo      = lookupRepo;
            _emailService    = emailService;
            _config          = config;
            _db              = db;
        }

        public async Task<(List<AdminReviewListDto> Items, int Total)> GetAllAsync(
            string? entityType, int? subtypeId, int? cityId, int? regionId,
            short? minRating, short? maxRating,
            string? gender, int? minAge, int? maxAge,
            bool? isHidden, int page, int pageSize, Guid currentUserId,
            string? search = null, List<string>? extraFilters = null)
        {
            List<Guid>? restrictToDestinationIds = null;
            List<int>?  restrictToCityIds        = null;
            Guid?       placeOwnerUserId         = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                // Isti obrazac kao AdminEventService — proveravamo i ManagedRegionId
                if (user.ManagedRegionId.HasValue)
                {
                    var cities = await _lookupRepo.GetCitiesAsync(user.ManagedRegionId);
                    restrictToCityIds = cities.Select(c => c.Id).ToList();
                }
                else
                {
                    var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                    restrictToDestinationIds = assignments.Select(a => a.DestinationId).ToList();
                    restrictToCityIds = await _destinationRepo.GetCityIdsByDestinationsAsync(restrictToDestinationIds);
                }
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                placeOwnerUserId = currentUserId;
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var (items, total) = await _reviewRepo.GetAdminPagedAsync(
                entityType, subtypeId, cityId, regionId, minRating, maxRating, gender, minAge, maxAge,
                isHidden, restrictToDestinationIds, restrictToCityIds, placeOwnerUserId,
                page, pageSize, search, extraFilters);

            var dtos = await EnrichWithEntityNamesAsync(items);
            return (dtos, total);
        }

        public async Task<AdminReviewListDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var review = await _reviewRepo.GetAdminByIdAsync(id);
            if (review == null) return null;

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (!await TOHasAccessToReview(currentUserId, review))
                    return null;
            }
            else if (user?.Role.Name == RoleNames.PlaceOwner)
            {
                if (!await PlaceOwnerHasAccessToReview(currentUserId, review))
                    return null;
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var dto = MapToDto(review);
            await FillEntityNameAsync(dto, review);
            return dto;
        }

        public async Task<bool> HideAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin && user?.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var review = await _reviewRepo.GetAdminByIdAsync(id);
            if (review == null) return false;

            if (user.Role.Name == RoleNames.TouristOrganization && !await TOHasAccessToReview(currentUserId, review))
                throw new UnauthorizedAccessException("You do not have access to this review.");

            review.IsHidden  = true;
            review.UpdatedAt = DateTimeOffset.UtcNow;
            review.UpdatedBy = currentUserId;

            _reviewRepo.Update(review);
            await _reviewRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ApproveAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin && user?.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var review = await _reviewRepo.GetAdminByIdAsync(id);
            if (review == null) return false;

            if (user.Role.Name == RoleNames.TouristOrganization && !await TOHasAccessToReview(currentUserId, review))
                throw new UnauthorizedAccessException("You do not have access to this review.");

            review.IsHidden  = false;
            review.UpdatedAt = DateTimeOffset.UtcNow;
            review.UpdatedBy = currentUserId;

            _reviewRepo.Update(review);
            await _reviewRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId, string? reason)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can delete reviews.");

            var review = await _reviewRepo.GetAdminByIdAsync(id);
            if (review == null) return false;

            // Učitaj korisnika koji je ostavio recenziju
            var reviewer = await _userRepo.GetByIdWithRoleAsync(review.UserId);

            // Odredi naziv i link entiteta pre brisanja
            var dto = MapToDto(review);
            await FillEntityNameAsync(dto, review);
            var entityName = dto.EntityName ?? review.EntityType;
            var entitySlug = dto.EntitySlug ?? "";
            var frontendBase = _config["FrontendSettings:BaseUrl"]?.TrimEnd('/') ?? "";
            var entityLink = string.IsNullOrEmpty(entitySlug)
                ? frontendBase
                : $"{frontendBase}/{review.EntityType}s/{entitySlug}";

            // Soft-delete
            review.IsDeleted = true;
            review.DeletedAt = DateTimeOffset.UtcNow;
            _reviewRepo.Update(review);
            await _reviewRepo.SaveChangesAsync();

            // Pošalji email korisniku
            if (reviewer != null && !string.IsNullOrWhiteSpace(reviewer.Email) && !string.IsNullOrWhiteSpace(reason))
            {
                try
                {
                    await _emailService.SendReviewDeletedEmailAsync(
                        reviewer.Email,
                        reviewer.FirstName,
                        entityName,
                        entityLink,
                        reason);
                }
                catch { /* email je non-fatal */ }
            }

            return true;
        }

        // ---- Helpers ----

        private async Task<List<AdminReviewListDto>> EnrichWithEntityNamesAsync(List<Review> reviews)
        {
            var dtos = reviews.Select(MapToDto).ToList();

            // Batch load entity names po tipu
            var destIds  = reviews.Where(r => r.EntityType == "destination").Select(r => r.EntityId).Distinct().ToList();
            var placeIds = reviews.Where(r => r.EntityType == "place").Select(r => r.EntityId).Distinct().ToList();
            var eventIds = reviews.Where(r => r.EntityType == "event").Select(r => r.EntityId).Distinct().ToList();
            var actIds   = reviews.Where(r => r.EntityType == "activity").Select(r => r.EntityId).Distinct().ToList();

            var destMap  = destIds.Count  > 0 ? await _db.Destinations.IgnoreQueryFilters().Where(d => destIds.Contains(d.Id)).Select(d => new { d.Id, d.Name, d.Slug }).ToDictionaryAsync(d => d.Id) : new();
            var placeMap = placeIds.Count > 0 ? await _db.Places.IgnoreQueryFilters().Where(p => placeIds.Contains(p.Id)).Select(p => new { p.Id, p.Name, p.Slug }).ToDictionaryAsync(p => p.Id) : new();
            var eventMap = eventIds.Count > 0 ? await _db.Events.IgnoreQueryFilters().Where(e => eventIds.Contains(e.Id)).Select(e => new { e.Id, e.Name, e.Slug }).ToDictionaryAsync(e => e.Id) : new();
            var actMap   = actIds.Count   > 0 ? await _db.Activities.IgnoreQueryFilters().Where(a => actIds.Contains(a.Id)).Select(a => new { a.Id, a.Name, a.Slug }).ToDictionaryAsync(a => a.Id) : new();

            foreach (var dto in dtos)
            {
                switch (dto.EntityType)
                {
                    case "destination" when destMap.TryGetValue(dto.EntityId, out var d):
                        dto.EntityName = d.Name; dto.EntitySlug = d.Slug; break;
                    case "place" when placeMap.TryGetValue(dto.EntityId, out var p):
                        dto.EntityName = p.Name; dto.EntitySlug = p.Slug; break;
                    case "event" when eventMap.TryGetValue(dto.EntityId, out var e):
                        dto.EntityName = e.Name; dto.EntitySlug = e.Slug; break;
                    case "activity" when actMap.TryGetValue(dto.EntityId, out var a):
                        dto.EntityName = a.Name; dto.EntitySlug = a.Slug; break;
                }
            }

            return dtos;
        }

        private async Task FillEntityNameAsync(AdminReviewListDto dto, Review review)
        {
            switch (review.EntityType)
            {
                case "destination":
                    var dest = await _db.Destinations.IgnoreQueryFilters().Where(d => d.Id == review.EntityId).Select(d => new { d.Name, d.Slug }).FirstOrDefaultAsync();
                    dto.EntityName = dest?.Name; dto.EntitySlug = dest?.Slug; break;
                case "place":
                    var place = await _db.Places.IgnoreQueryFilters().Where(p => p.Id == review.EntityId).Select(p => new { p.Name, p.Slug }).FirstOrDefaultAsync();
                    dto.EntityName = place?.Name; dto.EntitySlug = place?.Slug; break;
                case "event":
                    var ev = await _db.Events.IgnoreQueryFilters().Where(e => e.Id == review.EntityId).Select(e => new { e.Name, e.Slug }).FirstOrDefaultAsync();
                    dto.EntityName = ev?.Name; dto.EntitySlug = ev?.Slug; break;
                case "activity":
                    var act = await _db.Activities.IgnoreQueryFilters().Where(a => a.Id == review.EntityId).Select(a => new { a.Name, a.Slug }).FirstOrDefaultAsync();
                    dto.EntityName = act?.Name; dto.EntitySlug = act?.Slug; break;
            }
        }

        private async Task<bool> TOHasAccessToReview(Guid userId, Review review)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(userId);

            if (user?.ManagedRegionId.HasValue == true)
            {
                var cities = await _lookupRepo.GetCitiesAsync(user.ManagedRegionId);
                var cityIds = cities.Select(c => c.Id).ToList();

                switch (review.EntityType)
                {
                    case "destination":
                        return await _db.Destinations.IgnoreQueryFilters()
                            .AnyAsync(d => d.Id == review.EntityId && d.CityId.HasValue && cityIds.Contains(d.CityId.Value));
                    case "place":
                        return await _db.Places.IgnoreQueryFilters()
                            .AnyAsync(p => p.Id == review.EntityId && p.CityId.HasValue && cityIds.Contains(p.CityId.Value));
                    case "event":
                        return await _db.Events.IgnoreQueryFilters()
                            .AnyAsync(e => e.Id == review.EntityId && e.CityId.HasValue && cityIds.Contains(e.CityId.Value));
                    case "activity":
                        return await _db.Activities.IgnoreQueryFilters()
                            .AnyAsync(a => a.Id == review.EntityId && a.CityId.HasValue && cityIds.Contains(a.CityId.Value));
                    default:
                        return false;
                }
            }

            var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
            var destinationIds = assignments.Select(a => a.DestinationId).ToList();

            if (review.EntityType == "destination")
                return destinationIds.Contains(review.EntityId);

            return true;
        }

        private async Task<bool> PlaceOwnerHasAccessToReview(Guid ownerId, Review review)
        {
            if (review.EntityType == "place")
            {
                return await _db.Places.IgnoreQueryFilters()
                    .AnyAsync(p => p.Id == review.EntityId && p.CreatedBy == ownerId);
            }

            if (review.EntityType == "event")
            {
                var ownerPlaceIds = _db.Places.IgnoreQueryFilters()
                    .Where(p => p.CreatedBy == ownerId)
                    .Select(p => p.Id);

                return await _db.Events.IgnoreQueryFilters()
                    .AnyAsync(e =>
                        e.Id == review.EntityId &&
                        (e.CreatedBy == ownerId ||
                         (e.PlaceId.HasValue && ownerPlaceIds.Contains(e.PlaceId.Value))));
            }

            return false;
        }

        private static AdminReviewListDto MapToDto(Review r)
        {
            int? age = null;
            if (r.User.DateOfBirth.HasValue)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                age = today.Year - r.User.DateOfBirth.Value.Year;
                if (r.User.DateOfBirth.Value > today.AddYears(-age.Value)) age--;
            }

            return new AdminReviewListDto
            {
                Id                  = r.Id,
                EntityType          = r.EntityType,
                EntityId            = r.EntityId,
                UserId              = r.UserId,
                UserFullName        = $"{r.User.FirstName} {r.User.LastName}",
                UserGender          = r.User.Gender,
                UserAge             = age,
                UserProfileImageUrl = r.User.ProfileImageUrl,
                Rating              = r.Rating,
                Comment             = r.Comment,
                IsHidden            = r.IsHidden,
                CreatedAt           = r.CreatedAt,
                OwnerReply          = r.OwnerReply,
                OwnerReplyAt        = r.OwnerReplyAt,
                ImageUrls           = r.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).ToList()
            };
        }
    }
}
