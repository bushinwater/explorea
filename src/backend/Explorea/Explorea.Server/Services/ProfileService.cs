using Explorea.API.DTOs.User;
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

        public ProfileService(
            ISavedItemRepository savedItemRepository,
            AppDbContext db)
        {
            _savedItemRepository = savedItemRepository;
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
    }
}