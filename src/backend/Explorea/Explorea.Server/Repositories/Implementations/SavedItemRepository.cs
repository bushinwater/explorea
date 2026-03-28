using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class SavedItemRepository : BaseRepository<SavedItem>, ISavedItemRepository
    {
        public SavedItemRepository(AppDbContext db) : base(db) { }

        public async Task<(List<SavedItem> Items, int Total)> GetByUserAsync(
            Guid userId, int page, int pageSize)
        {
            var query = _set.Where(s => s.UserId == userId);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(s => s.SavedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task DeleteByEntityAsync(Guid userId, string entityType, Guid entityId)
        {
            var item = await _set.FirstOrDefaultAsync(s =>
                s.UserId == userId &&
                s.EntityType == entityType &&
                s.EntityId == entityId);

            if (item != null)
            {
                _set.Remove(item);
                await _db.SaveChangesAsync();
            }
        }
    }
}