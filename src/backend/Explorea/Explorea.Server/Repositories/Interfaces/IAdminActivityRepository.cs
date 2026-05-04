using Explorea.API.Models;

namespace Explorea.Server.Repositories.Admin.Interfaces
{
    public interface IAdminActivityRepository
    {
        IQueryable<Activity> Query();

        Task<Activity?> GetByIdAsync(Guid id);

        Task AddAsync(Activity activity);

        void Update(Activity activity);

        void Delete(Activity activity);

        Task<int> SaveChangesAsync();
    }
}