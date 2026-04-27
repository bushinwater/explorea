using Explorea.API.DTOs.Admin.Review;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminReviewService : IAdminReviewService
    {
        private readonly IAdminReviewRepository _reviewRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IDestinationRepository _destinationRepo;
        private readonly IUserRepository _userRepo;

        public AdminReviewService(
            IAdminReviewRepository reviewRepo,
            IOrganizationAssignmentRepository assignmentRepo,
            IDestinationRepository destinationRepo,
            IUserRepository userRepo)
        {
            _reviewRepo     = reviewRepo;
            _assignmentRepo = assignmentRepo;
            _destinationRepo = destinationRepo;
            _userRepo       = userRepo;
        }

        public async Task<(List<AdminReviewListDto> Items, int Total)> GetAllAsync(
            string? entityType, int? cityId,
            short? minRating, short? maxRating,
            string? gender, int? minAge, int? maxAge,
            bool? isHidden, int page, int pageSize, Guid currentUserId)
        {
            List<Guid>? restrictToDestinationIds = null;
            List<int>?  restrictToCityIds        = null;
            Guid?       placeOwnerUserId         = null;

            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
                restrictToDestinationIds = assignments.Select(a => a.DestinationId).ToList();
                restrictToCityIds = await _destinationRepo.GetCityIdsByDestinationsAsync(restrictToDestinationIds);
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
                entityType, cityId, minRating, maxRating, gender, minAge, maxAge,
                isHidden, restrictToDestinationIds, restrictToCityIds, placeOwnerUserId,
                page, pageSize);

            return (items.Select(MapToDto).ToList(), total);
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
                if (review.EntityType != "place")
                    return null;
            }
            else if (user?.Role.Name != RoleNames.SuperAdmin)
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            return MapToDto(review);
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

        public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can delete reviews.");

            var review = await _reviewRepo.GetAdminByIdAsync(id);
            if (review == null) return false;

            review.IsDeleted = true;
            review.DeletedAt = DateTimeOffset.UtcNow;

            _reviewRepo.Update(review);
            await _reviewRepo.SaveChangesAsync();
            return true;
        }

        // ---- Helpers ----

        private async Task<bool> TOHasAccessToReview(Guid userId, Review review)
        {
            var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
            var destinationIds = assignments.Select(a => a.DestinationId).ToList();
            var cityIds = await _destinationRepo.GetCityIdsByDestinationsAsync(destinationIds);

            if (review.EntityType == "destination")
                return destinationIds.Contains(review.EntityId);

            return true;
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
                Id           = r.Id,
                EntityType   = r.EntityType,
                EntityId     = r.EntityId,
                UserId       = r.UserId,
                UserFullName = $"{r.User.FirstName} {r.User.LastName}",
                UserGender   = r.User.Gender,
                UserAge      = age,
                Rating       = r.Rating,
                Comment      = r.Comment,
                IsHidden     = r.IsHidden,
                CreatedAt    = r.CreatedAt
            };
        }
    }
}
