using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Admin
{
  public class AdminActivityRepository : IAdminActivityRepository
  {
    private readonly AppDbContext _context;

    public AdminActivityRepository(AppDbContext context)
    {
      _context = context;
    }
    public IQueryable<Activity> Query()
    {
      return _context.Activities
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.City)
          .ThenInclude(c => c!.Region)
        .Include(a => a.Destination)
        .Include(a => a.Images);
    }
    public async Task<Activity?> GetByIdAsync(Guid id)
    {
      return await _context.Activities
        .Include(a => a.Category)
        .Include(a => a.City)
          .ThenInclude(c => c!.Region)
        .Include(a => a.Destination)
        .Include(a => a.Images)
        .FirstOrDefaultAsync(a => a.Id == id);
    }
    public async Task AddAsync(Activity activity)
    {
      await _context.Activities.AddAsync(activity);
    }
    public void Update(Activity activity)
    {
      _context.Activities.Update(activity);
    }
    public void Delete(Activity activity)
    {
      activity.IsDeleted = true;
      activity.DeletedAt = DateTimeOffset.UtcNow;
      _context.Activities.Update(activity);
    }
    public async Task<int> SaveChangesAsync()
    {
      return await _context.SaveChangesAsync();
    }
  }
}