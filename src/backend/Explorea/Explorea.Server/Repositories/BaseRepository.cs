using Explorea.Server.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Explorea.Server.Repositories
{
    // interfejs
    public interface IBaseRepository<T> where T : class
    {
        Task<T?> GetByIdAsync(Guid id);
        Task<List<T>> GetAllAsync();
        Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate);
        Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
        Task AddAsync(T entity);
        Task AddRangeAsync(IEnumerable<T> entities);
        void Update(T entity);
        void Remove(T entity);
        Task<int> SaveChangesAsync();
    }

    // implementacija
    public class BaseRepository<T> : IBaseRepository<T> where T : class
    {
        protected readonly AppDbContext _db;
        protected readonly DbSet<T> _set;

        public BaseRepository(AppDbContext db)
        {
            _db = db;
            _set = db.Set<T>();
        }

        public async Task<T?> GetByIdAsync(Guid id)
            => await _set.FindAsync(id);

        public async Task<List<T>> GetAllAsync()
            => await _set.ToListAsync();

        public async Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate)
            => await _set.Where(predicate).ToListAsync();

        public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
            => await _set.FirstOrDefaultAsync(predicate);

        public async Task AddAsync(T entity)
            => await _set.AddAsync(entity);

        public async Task AddRangeAsync(IEnumerable<T> entities)
            => await _set.AddRangeAsync(entities);

        public void Update(T entity)
            => _set.Update(entity);

        public void Remove(T entity)
            => _set.Remove(entity);

        public async Task<int> SaveChangesAsync()
            => await _db.SaveChangesAsync();
    }
}
