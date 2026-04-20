using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class NewsletterRepository : INewsletterRepository
    {
        private readonly AppDbContext _db;

        public NewsletterRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<Newsletter?> GetByEmailAsync(string email)
        {
            return await _db.Newsletters.FirstOrDefaultAsync(x => x.Email == email);
        }

        public async Task<bool> ExistsAsync(string email)
        {
            return await _db.Newsletters.AnyAsync(x => x.Email == email && x.Subscribed);
        }

        public async Task<List<string>> GetAllEmailsAsync()
        {
            return await _db.Newsletters
                .Where(x => x.Subscribed)
                .Select(x => x.Email)
                .ToListAsync();
        }

        public async Task AddAsync(Newsletter newsletter)
        {
            await _db.Newsletters.AddAsync(newsletter);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}