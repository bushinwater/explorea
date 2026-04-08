using Explorea.API.DTOs.User;
using Explorea.API.DTOs.Review;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class ProfileService : IProfileService
    {
        private static readonly HashSet<string> AllowedEntityTypes =
            new(StringComparer.OrdinalIgnoreCase) { "destination", "place", "event", "activity" };

        private readonly ISavedItemRepository _savedItemRepository;
        private readonly AppDbContext _db;
        private readonly IReviewRepository _reviewRepository;
        private readonly IUserRepository _userRepository;
        private readonly IAiBotService _aiBotService;

        public ProfileService(
            IUserRepository userRepository,
            ISavedItemRepository savedItemRepository,
            IReviewRepository reviewRepository,
            IAiBotService aiBotService,
            AppDbContext db)
        {
            _userRepository = userRepository;
            _savedItemRepository = savedItemRepository;
            _reviewRepository = reviewRepository;
            _aiBotService = aiBotService;
            _db = db;
        }

        public async Task<List<SavedItemDto>> GetSavedItemsAsync(Guid userId)
        {
            var savedItems = await _db.SavedItems
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.SavedAt)
                .ToListAsync();

            var result = new List<SavedItemDto>();

            foreach (var item in savedItems)
            {
                var mapped = await MapSavedItemAsync(item);
                if (mapped != null)
                    result.Add(mapped);
            }

            return result;
        }

        public async Task SaveItemAsync(Guid userId, SavedItemRequestDto dto)
        {
            var entityType = NormalizeEntityType(dto.EntityType);

            var exists = await EntityExistsAsync(entityType, dto.EntityId);
            if (!exists)
                throw new Exception($"Entity of type '{entityType}' was not found.");

            var alreadySaved = await _savedItemRepository.FirstOrDefaultAsync(x =>
                x.UserId == userId &&
                x.EntityType == entityType &&
                x.EntityId == dto.EntityId);

            if (alreadySaved != null)
                return;

            var savedItem = new SavedItem
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = entityType,
                EntityId = dto.EntityId,
                SavedAt = DateTimeOffset.UtcNow,
                CreatedBy = userId,
                UpdatedBy = userId
            };

            await _savedItemRepository.AddAsync(savedItem);
            await _savedItemRepository.SaveChangesAsync();
        }

        public async Task RemoveSavedItemAsync(Guid userId, string entityType, Guid entityId)
        {
            var normalizedEntityType = NormalizeEntityType(entityType);
            await _savedItemRepository.DeleteByEntityAsync(userId, normalizedEntityType, entityId);
        }

        public async Task<List<ProfileReviewDto>> GetMyReviewsAsync(Guid userId)
        {
            var reviews = await _db.Reviews
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var result = new List<ProfileReviewDto>();

            foreach (var review in reviews)
            {
                var mapped = await MapReviewAsync(review);
                if (mapped != null)
                    result.Add(mapped);
            }

            return result;
        }

        public async Task<ProfileReviewDto> AddReviewAsync(Guid userId, CreateReviewDto dto)
        {
            var entityType = NormalizeEntityType(dto.EntityType);

            if (dto.Rating < 1 || dto.Rating > 5)
                throw new Exception("Rating must be between 1 and 5.");

            var exists = await EntityExistsAsync(entityType, dto.EntityId);
            if (!exists)
                throw new Exception($"Entity of type '{entityType}' was not found.");

            var existingReview = await _reviewRepository.FirstOrDefaultAsync(r =>
                r.UserId == userId &&
                r.EntityType == entityType &&
                r.EntityId == dto.EntityId);

            var now = DateTimeOffset.UtcNow;

            if (existingReview == null)
            {
                existingReview = new Review
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    EntityType = entityType,
                    EntityId = dto.EntityId,
                    Rating = (short)dto.Rating,
                    Comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim(),
                    CreatedAt = now,
                    UpdatedAt = now,
                    CreatedBy = userId,
                    UpdatedBy = userId
                };

                await _reviewRepository.AddAsync(existingReview);
            }
            else
            {
                existingReview.Rating = (short)dto.Rating;
                existingReview.Comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim();
                existingReview.UpdatedAt = now;
                existingReview.UpdatedBy = userId;

                _reviewRepository.Update(existingReview);
            }

            await _reviewRepository.SaveChangesAsync();

            return await MapReviewAsync(existingReview)
                ?? throw new Exception("Unable to map review.");
        }

        public async Task<UserProfileDto> GetProfileAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            var preferences = await _userRepository.GetPreferencesAsync(userId);

            return MapUserProfile(user, preferences);
        }

        public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateUserDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            if (string.IsNullOrWhiteSpace(dto.FirstName))
                throw new Exception("First name is required.");

            if (string.IsNullOrWhiteSpace(dto.LastName))
                throw new Exception("Last name is required.");

            user.FirstName = dto.FirstName.Trim();
            user.LastName = dto.LastName.Trim();
            user.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl)
                ? null
                : dto.ProfileImageUrl.Trim();

            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = userId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            var preferences = await _userRepository.GetPreferencesAsync(userId);

            return MapUserProfile(user, preferences);
        }

        public async Task SendSupportAsync(Guid userId, SupportRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Query))
                throw new Exception("Support query is required.");

            await _aiBotService.ForwardSupportQueryAsync(userId, dto.Query.Trim());
        }

        public async Task<ProfileStatsDto> GetStatsAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            var reviewsCount = await _db.Reviews.CountAsync(r => r.UserId == userId);
            var savedItemsCount = await _db.SavedItems.CountAsync(s => s.UserId == userId);

            return new ProfileStatsDto
            {
                ReviewsCount = reviewsCount,
                SavedItemsCount = savedItemsCount,
                MemberSince = user.MemberSince
            };
        }

        private static UserProfileDto MapUserProfile(User user, UserPreferences? preferences)
        {
            return new UserProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                TravelerRank = user.TravelerRank,
                TotalVisits = user.TotalVisits,
                MemberSince = user.MemberSince,
                ProfileImageUrl = user.ProfileImageUrl,
                CurrentLatitude = user.CurrentLatitude,
                CurrentLongitude = user.CurrentLongitude,
                CurrentCityId = user.CurrentCityId,
                Preferences = preferences == null
                    ? null
                    : new UserPreferencesDto
                    {
                        Theme = preferences.Theme,
                        Language = preferences.Language,
                        NotificationsEnabled = preferences.NotificationsEnabled
                    }
            };
        }

        private static string NormalizeEntityType(string entityType)
        {
            if (string.IsNullOrWhiteSpace(entityType))
                throw new Exception("Entity type is required.");

            var normalized = entityType.Trim().ToLower();

            if (!AllowedEntityTypes.Contains(normalized))
                throw new Exception("Entity type must be one of: destination, place, event, activity.");

            return normalized;
        }

        private async Task<bool> EntityExistsAsync(string entityType, Guid entityId)
        {
            return entityType switch
            {
                "destination" => await _db.Destinations.AnyAsync(x => x.Id == entityId),
                "place" => await _db.Places.AnyAsync(x => x.Id == entityId),
                "event" => await _db.Events.AnyAsync(x => x.Id == entityId),
                "activity" => await _db.Activities.AnyAsync(x => x.Id == entityId),
                _ => false
            };
        }

        private async Task<SavedItemDto?> MapSavedItemAsync(SavedItem item)
        {
            return item.EntityType.ToLower() switch
            {
                "destination" => await _db.Destinations
                    .Where(x => x.Id == item.EntityId)
                    .Select(x => new SavedItemDto
                    {
                        Id = item.Id,
                        EntityType = item.EntityType,
                        EntityId = item.EntityId,
                        Name = x.Name,
                        Slug = x.Slug,
                        PreviewImageUrl = x.PreviewImageUrl,
                        Subtitle = x.City != null ? x.City.Name : null,
                        SavedAt = item.SavedAt
                    })
                    .FirstOrDefaultAsync(),

                "place" => await _db.Places
                    .Where(x => x.Id == item.EntityId)
                    .Select(x => new SavedItemDto
                    {
                        Id = item.Id,
                        EntityType = item.EntityType,
                        EntityId = item.EntityId,
                        Name = x.Name,
                        Slug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Subtitle = x.Address,
                        SavedAt = item.SavedAt
                    })
                    .FirstOrDefaultAsync(),

                "event" => await _db.Events
                    .Where(x => x.Id == item.EntityId)
                    .Select(x => new SavedItemDto
                    {
                        Id = item.Id,
                        EntityType = item.EntityType,
                        EntityId = item.EntityId,
                        Name = x.Name,
                        Slug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Subtitle = x.Address,
                        SavedAt = item.SavedAt
                    })
                    .FirstOrDefaultAsync(),

                "activity" => await _db.Activities
                    .Where(x => x.Id == item.EntityId)
                    .Select(x => new SavedItemDto
                    {
                        Id = item.Id,
                        EntityType = item.EntityType,
                        EntityId = item.EntityId,
                        Name = x.Name,
                        Slug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Subtitle = x.StartPoint,
                        SavedAt = item.SavedAt
                    })
                    .FirstOrDefaultAsync(),

                _ => null
            };
        }

        private async Task<ProfileReviewDto?> MapReviewAsync(Review review)
        {
            return review.EntityType.ToLower() switch
            {
                "destination" => await _db.Destinations
                    .Where(x => x.Id == review.EntityId)
                    .Select(x => new ProfileReviewDto
                    {
                        Id = review.Id,
                        EntityType = review.EntityType,
                        EntityId = review.EntityId,
                        EntityName = x.Name,
                        EntitySlug = x.Slug,
                        PreviewImageUrl = x.PreviewImageUrl,
                        Rating = review.Rating,
                        Comment = review.Comment,
                        CreatedAt = review.CreatedAt,
                        UpdatedAt = review.UpdatedAt
                    })
                    .FirstOrDefaultAsync(),

                "place" => await _db.Places
                    .Where(x => x.Id == review.EntityId)
                    .Select(x => new ProfileReviewDto
                    {
                        Id = review.Id,
                        EntityType = review.EntityType,
                        EntityId = review.EntityId,
                        EntityName = x.Name,
                        EntitySlug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Rating = review.Rating,
                        Comment = review.Comment,
                        CreatedAt = review.CreatedAt,
                        UpdatedAt = review.UpdatedAt
                    })
                    .FirstOrDefaultAsync(),

                "event" => await _db.Events
                    .Where(x => x.Id == review.EntityId)
                    .Select(x => new ProfileReviewDto
                    {
                        Id = review.Id,
                        EntityType = review.EntityType,
                        EntityId = review.EntityId,
                        EntityName = x.Name,
                        EntitySlug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Rating = review.Rating,
                        Comment = review.Comment,
                        CreatedAt = review.CreatedAt,
                        UpdatedAt = review.UpdatedAt
                    })
                    .FirstOrDefaultAsync(),

                "activity" => await _db.Activities
                    .Where(x => x.Id == review.EntityId)
                    .Select(x => new ProfileReviewDto
                    {
                        Id = review.Id,
                        EntityType = review.EntityType,
                        EntityId = review.EntityId,
                        EntityName = x.Name,
                        EntitySlug = x.Slug,
                        PreviewImageUrl = x.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Rating = review.Rating,
                        Comment = review.Comment,
                        CreatedAt = review.CreatedAt,
                        UpdatedAt = review.UpdatedAt
                    })
                    .FirstOrDefaultAsync(),

                _ => null
            };
        }
    }
}