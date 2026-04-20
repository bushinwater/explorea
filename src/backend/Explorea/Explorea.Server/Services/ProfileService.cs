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
        private readonly ICloudinaryService _cloudinaryService;
        private readonly INewsletterService _newsletterService;

        public ProfileService(
            IUserRepository userRepository,
            ISavedItemRepository savedItemRepository,
            IReviewRepository reviewRepository,
            IAiBotService aiBotService,
            ICloudinaryService cloudinaryService,
            INewsletterService newsletterService,
            AppDbContext db)
        {
            _userRepository = userRepository;
            _savedItemRepository = savedItemRepository;
            _reviewRepository = reviewRepository;
            _aiBotService = aiBotService;
            _cloudinaryService = cloudinaryService;
            _newsletterService = newsletterService;
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

        private static readonly string[] NameBlacklist =
        [
            "kurac", "picka", "pička", "pizda", "guzica", "sisa", "jebem", "jebo",
            "nigger", "nigga", "niger", "fuck", "shit", "dick", "cunt", "bitch",
            "asshole", "retard", "faggot", "pussy", "cock", "whore", "slut",
        ];

        private static void ValidateName(string value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new Exception($"{fieldName} is required.");

            if (!System.Text.RegularExpressions.Regex.IsMatch(value.Trim(), @"^[a-zA-ZčćžšđČĆŽŠĐ]+$"))
                throw new Exception($"{fieldName} must contain letters only.");

            var lower = value.Trim().ToLower();
            if (NameBlacklist.Any(w => lower.Contains(w)))
                throw new Exception($"{fieldName} contains forbidden content.");
        }

        public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateUserDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            ValidateName(dto.FirstName, "First name");
            ValidateName(dto.LastName, "Last name");

            user.FirstName = dto.FirstName.Trim();
            user.LastName = dto.LastName.Trim();
            user.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl)
                ? null
                : dto.ProfileImageUrl.Trim();
            user.Gender = string.IsNullOrWhiteSpace(dto.Gender) ? null : dto.Gender.Trim().ToLower();
            user.DateOfBirth = dto.DateOfBirth;

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

        public async Task<List<ForYouItemDto>> GetForYouAsync(Guid userId)
        {
            var interestIds = await _db.UserInterestTags
                .Where(x => x.UserId == userId)
                .Select(x => x.InterestTagId)
                .ToListAsync();

            var items = new List<ForYouItemDto>();

            if (interestIds.Count > 0)
            {
                // Destinations
                var destMatches = await _db.DestinationInterestTags
                    .Where(x => interestIds.Contains(x.InterestTagId))
                    .GroupBy(x => x.DestinationId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToListAsync();

                if (destMatches.Count > 0)
                {
                    var destIds = destMatches.Select(x => x.Id).ToList();
                    var dests = await _db.Destinations
                        .Where(d => destIds.Contains(d.Id))
                        .Select(d => new { d.Id, d.Name, d.Slug, PreviewImageUrl = d.HeroImageUrl, d.AvgRating })
                        .ToListAsync();

                    items.AddRange(destMatches.Join(dests, m => m.Id, d => d.Id, (m, d) => new ForYouItemDto
                    {
                        Id = d.Id, EntityType = "destination",
                        Name = d.Name, Slug = d.Slug,
                        PreviewImageUrl = d.PreviewImageUrl,
                        AvgRating = (double)d.AvgRating, MatchedTagsCount = m.Count
                    }));
                }

                // Places
                var placeMatches = await _db.PlaceInterestTags
                    .Where(x => interestIds.Contains(x.InterestTagId))
                    .GroupBy(x => x.PlaceId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToListAsync();

                if (placeMatches.Count > 0)
                {
                    var placeIds = placeMatches.Select(x => x.Id).ToList();
                    var places = await _db.Places
                        .Where(p => placeIds.Contains(p.Id))
                        .Select(p => new { p.Id, p.Name, p.Slug, p.Address, p.AvgRating,
                            PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
                        .ToListAsync();

                    items.AddRange(placeMatches.Join(places, m => m.Id, p => p.Id, (m, p) => new ForYouItemDto
                    {
                        Id = p.Id, EntityType = "place",
                        Name = p.Name, Slug = p.Slug,
                        PreviewImageUrl = p.PreviewImageUrl,
                        Subtitle = p.Address,
                        AvgRating = (double)p.AvgRating, MatchedTagsCount = m.Count
                    }));
                }

                // Events
                var eventMatches = await _db.EventInterestTags
                    .Where(x => interestIds.Contains(x.InterestTagId))
                    .GroupBy(x => x.EventId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToListAsync();

                if (eventMatches.Count > 0)
                {
                    var eventIds = eventMatches.Select(x => x.Id).ToList();
                    var events = await _db.Events
                        .Where(e => eventIds.Contains(e.Id))
                        .Select(e => new {
                            e.Id,
                            e.Name,
                            e.Slug,
                            e.Address,
                            e.Popularity,
                            e.AvgRating,
                            PreviewImageUrl = e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault()
                        })
                        .ToListAsync();

                    items.AddRange(eventMatches.Join(events, m => m.Id, e => e.Id, (m, e) => new ForYouItemDto
                    {
                        Id = e.Id,
                        EntityType = "event",
                        Name = e.Name,
                        Slug = e.Slug,
                        PreviewImageUrl = e.PreviewImageUrl,
                        Subtitle = e.Address,
                        AvgRating = (double)e.AvgRating,
                        MatchedTagsCount = m.Count
                    }));
                }

                // Activities
                var actMatches = await _db.ActivityInterestTags
                    .Where(x => interestIds.Contains(x.InterestTagId))
                    .GroupBy(x => x.ActivityId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToListAsync();

                if (actMatches.Count > 0)
                {
                    var actIds = actMatches.Select(x => x.Id).ToList();
                    var acts = await _db.Activities
                        .Where(a => actIds.Contains(a.Id))
                        .Select(a => new { a.Id, a.Name, a.Slug, a.StartPoint, a.AvgRating,
                            PreviewImageUrl = a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
                        .ToListAsync();

                    items.AddRange(actMatches.Join(acts, m => m.Id, a => a.Id, (m, a) => new ForYouItemDto
                    {
                        Id = a.Id, EntityType = "activity",
                        Name = a.Name, Slug = a.Slug,
                        PreviewImageUrl = a.PreviewImageUrl,
                        Subtitle = a.StartPoint,
                        AvgRating = (double)a.AvgRating, MatchedTagsCount = m.Count
                    }));
                }
            }

            // Fallback: ako nema interesa ili nema poklapanja, vrati top-rated po svim tipovima
            if (items.Count == 0)
            {
                var topDests = await _db.Destinations
                    .OrderByDescending(d => d.Popularity).ThenByDescending(d => d.AvgRating)
                    .Take(3)
                    .Select(d => new ForYouItemDto
                    {
                        Id = d.Id, EntityType = "destination",
                        Name = d.Name, Slug = d.Slug,
                        PreviewImageUrl = d.HeroImageUrl,
                        AvgRating = (double)d.AvgRating, MatchedTagsCount = 0
                    })
                    .ToListAsync();

                var topActs = await _db.Activities
                    .OrderByDescending(a => a.Popularity).ThenByDescending(a => a.AvgRating)
                    .Take(4)
                    .Select(a => new ForYouItemDto
                    {
                        Id = a.Id, EntityType = "activity",
                        Name = a.Name, Slug = a.Slug,
                        PreviewImageUrl = a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                        Subtitle = a.StartPoint,
                        AvgRating = (double)a.AvgRating, MatchedTagsCount = 0
                    })
                    .ToListAsync();

                var topEvents = await _db.Events
                     .OrderByDescending(e => e.Popularity).ThenByDescending(e => e.AvgRating)
                     .Take(3)
                     .Select(e => new ForYouItemDto
                     {
                         Id = e.Id,
                         EntityType = "event",
                         Name = e.Name,
                         Slug = e.Slug,
                         PreviewImageUrl = e.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                         Subtitle = e.Address,
                         AvgRating = (double)e.AvgRating,
                         MatchedTagsCount = 0
                     })
                     .ToListAsync();

                items.AddRange(topDests);
                items.AddRange(topActs);
                items.AddRange(topEvents);
            }

            return items
                .OrderByDescending(x => x.MatchedTagsCount)
                .ThenByDescending(x => x.AvgRating)
                .Take(10)
                .ToList();
        }

        public async Task RemoveAvatarAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            user.ProfileImageUrl = null;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = userId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();
        }

        public async Task<string> UploadAvatarAsync(Guid userId, IFormFile file)
        {
            var url = await _cloudinaryService.UploadImageAsync(file, "explorea/avatars");

            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            user.ProfileImageUrl = url;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = userId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            return url;
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
                Gender = user.Gender,
                DateOfBirth = user.DateOfBirth,
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
                    },
                Newsletter = user.Newsletter
            };
        }

        public async Task<bool> UpdateNewsletterAsync(Guid userId, bool newsletter)
        {
            return await _newsletterService.UpdateUserSubscriptionAsync(userId, newsletter);
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
                        PreviewImageUrl = x.HeroImageUrl,
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
                        PreviewImageUrl = x.HeroImageUrl,
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
