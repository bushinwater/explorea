using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class ReviewRepository : BaseRepository<Review>, IReviewRepository
    {
        public ReviewRepository(AppDbContext db) : base(db) { }

        public async Task<(List<Review> Items, int Total)> GetPagedAsync(
            string entityType, Guid entityId, int page, int pageSize)
        {
            var query = _set
                .Include(r => r.User)
                .Where(r => r.EntityType == entityType && r.EntityId == entityId);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task DeleteByUserAsync(Guid id, Guid userId)
        {
            var review = await _set
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

            if (review != null)
            {
                _set.Remove(review);
                await _db.SaveChangesAsync();
            }
        }
    }
}