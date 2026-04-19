using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface INewsletterRepository
    {
        Task<Newsletter?> GetByEmailAsync(string email);
        Task<bool> ExistsAsync(string email);
        Task<List<string>> GetAllEmailsAsync();
        Task AddAsync(Newsletter newsletter);
        void Remove(Newsletter newsletter);
        Task<int> SaveChangesAsync();
    }
}