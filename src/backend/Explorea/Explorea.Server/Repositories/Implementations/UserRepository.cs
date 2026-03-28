using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class UserRepository : BaseRepository<User>, IUserRepository
    {
        public UserRepository(AppDbContext db) : base(db) { }

        public async Task<User?> GetByEmailAsync(string email)
        {
            return await _set
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        public async Task<UserPreferences?> GetPreferencesAsync(Guid userId)
        {
            return await _db.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public async Task UpsertPreferencesAsync(UserPreferences preferences)
        {
            var existing = await _db.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == preferences.UserId);

            if (existing == null)
                await _db.UserPreferences.AddAsync(preferences);
            else
            {
                existing.Theme = preferences.Theme;
                existing.Language = preferences.Language;
                existing.NotificationsEnabled = preferences.NotificationsEnabled;
            }

            await _db.SaveChangesAsync();
        }

        public async Task<List<InterestTag>> GetInterestsAsync(Guid userId)
        {
            return await _db.UserInterestTags
                .Where(t => t.UserId == userId)
                .Include(t => t.InterestTag)
                .Select(t => t.InterestTag)
                .ToListAsync();
        }

        public async Task UpdateInterestsAsync(Guid userId, List<int> interestTagIds)
        {
            var existing = await _db.UserInterestTags
                .Where(t => t.UserId == userId)
                .ToListAsync();

            _db.UserInterestTags.RemoveRange(existing);

            var newTags = interestTagIds.Select(id => new UserInterestTag
            {
                UserId = userId,
                InterestTagId = id
            });

            await _db.UserInterestTags.AddRangeAsync(newTags);
            await _db.SaveChangesAsync();
        }

        public async Task<(List<User> Items, int Total)> GetPagedAsync(
            int page, int pageSize)
        {
            var query = _set.Include(u => u.Role);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task SetActiveAsync(Guid userId, bool isActive)
        {
            var user = await _set.FindAsync(userId);
            if (user != null)
            {
                user.IsActive = isActive;
                await _db.SaveChangesAsync();
            }
        }
    }
}