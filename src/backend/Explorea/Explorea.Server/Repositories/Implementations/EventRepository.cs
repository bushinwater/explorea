using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class EventRepository : BaseRepository<Event>, IEventRepository
    {
        public EventRepository(AppDbContext db) : base(db) { }

        public async Task<Event?> GetBySlugAsync(string slug)
        {
            return await _set
                .Include(e => e.City)
                .Include(e => e.Destination)
                .Include(e => e.Place)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .FirstOrDefaultAsync(e =>
                    e.Slug == slug &&
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow);
        }

        public async Task<Event?> GetEventDetailsBySlugAsync(string slug)
        {
            return await _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.City)
                .Include(e => e.Destination).ThenInclude(d => d!.City)
                .Include(e => e.Place)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Include(e => e.InterestTags)
                    .ThenInclude(link => link.InterestTag)
                .FirstOrDefaultAsync(e =>
                    e.Slug == slug &&
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow);
        }

        public async Task<List<Review>> GetEventReviewsAsync(Guid eventId, int take = 15)
        {
            return await _db.Reviews
                .AsNoTracking()
                .Include(r => r.User)
                .Where(r => r.EntityType == "event" && r.EntityId == eventId)
                .OrderByDescending(r => r.CreatedAt)
                .Take(take)
                .ToListAsync();
        }

        public async Task<List<Event>> GetSimilarEventsAsync(Event eventEntity, int take = 12)
        {
            var eventTagIds = eventEntity.InterestTags
                .Select(t => t.InterestTagId)
                .ToList();

            var hasTagIds = eventTagIds.Count > 0;

            var candidates = await _db.Events
                .AsNoTracking()
                .Include(e => e.Type)
                .Include(e => e.City)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Include(e => e.InterestTags)
                .Where(e =>
                    e.Id != eventEntity.Id &&
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow &&
                    (
                        e.TypeId == eventEntity.TypeId ||
                        (hasTagIds && e.InterestTags.Any(t => eventTagIds.Contains(t.InterestTagId))) ||
                        (eventEntity.DestinationId != null && e.DestinationId == eventEntity.DestinationId) ||
                        (eventEntity.CityId != null && e.CityId == eventEntity.CityId) ||
                        (eventEntity.CountryId != null && e.CountryId == eventEntity.CountryId)
                    ))
                .ToListAsync();

            return candidates
                .Select(e => new
                {
                    Event = e,
                    Score =
                        (e.TypeId == eventEntity.TypeId ? 10 : 0) +
                        e.InterestTags.Count(t => eventTagIds.Contains(t.InterestTagId)) * 3 +
                        (eventEntity.DestinationId != null && e.DestinationId == eventEntity.DestinationId ? 4 : 0) +
                        (eventEntity.CityId != null && e.CityId == eventEntity.CityId ? 2 : 0) +
                        (eventEntity.CountryId != null && e.CountryId == eventEntity.CountryId ? 1 : 0) +
                        (e.IsFeatured ? 2 : 0) +
                        (double)e.Popularity / 100.0 +
                        (double)e.AvgRating / 5.0
                })
                .OrderByDescending(x => x.Score)
                .Take(take)
                .Select(x => x.Event)
                .ToList();
        }

        public async Task<(List<Event> Items, int Total)> GetPagedAsync(
            int? cityId, int? typeId, DateTimeOffset? from,
            DateTimeOffset? to, bool? free, int page, int pageSize)
        {
            var query = _set
                .Include(e => e.City)
                .Include(e => e.Destination).ThenInclude(d => d!.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e =>
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId);

            if (from.HasValue && to.HasValue)
            {
                query = query.Where(e => e.StartDatetime < to && e.EndDatetime >= from);
            }
            else
            {
                if (from.HasValue)
                    query = query.Where(e => e.EndDatetime >= from);

                if (to.HasValue)
                    query = query.Where(e => e.StartDatetime < to);
            }

            if (free.HasValue && free.Value)
                query = query.Where(e => e.Price == null || e.Price == 0);

            var total = await query.CountAsync();

            var items = await query.ToListAsync();

            return (items, total);
        }

        public async Task<List<Event>> GetByMonthAsync(int year, int month)
        {
            var monthStartUtc = new DateTimeOffset(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc));
            var nextMonthStartUtc = monthStartUtc.AddMonths(1);

            return await _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e =>
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow &&
                    e.StartDatetime < nextMonthStartUtc &&
                    e.EndDatetime >= monthStartUtc)
                .OrderBy(e => e.StartDatetime)
                .ToListAsync();
        }

        public async Task<List<Event>> GetByMonthFilteredAsync(
            int year,
            int month,
            int? cityId,
            int? typeId,
            bool? free)
        {
            var monthStartUtc = new DateTimeOffset(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc));
            var nextMonthStartUtc = monthStartUtc.AddMonths(1);

            var query = _set
                .Include(e => e.City)
                .Include(e => e.Type)
                .Include(e => e.Country)
                .Include(e => e.Images)
                .Where(e =>
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.EndDatetime >= DateTimeOffset.UtcNow &&
                    e.StartDatetime < nextMonthStartUtc &&
                    e.EndDatetime >= monthStartUtc)
                .AsQueryable();

            if (cityId.HasValue)
                query = query.Where(e => e.CityId == cityId);

            if (typeId.HasValue)
                query = query.Where(e => e.TypeId == typeId);

            if (free.HasValue && free.Value)
                query = query.Where(e => e.Price == null || e.Price == 0);

            return await query
                .OrderBy(e => e.StartDatetime)
                .ToListAsync();
        }
    }
}
