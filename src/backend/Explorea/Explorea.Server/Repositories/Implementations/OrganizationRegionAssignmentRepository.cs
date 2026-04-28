using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class OrganizationRegionAssignmentRepository : IOrganizationRegionAssignmentRepository
    {
        private readonly AppDbContext _db;

        public OrganizationRegionAssignmentRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<OrganizationRegionAssignment>> GetByUserIdAsync(Guid userId)
        {
            return await _db.OrganizationRegionAssignments
                .Include(a => a.Region)
                .Where(a => a.OrganizationUserId == userId)
                .ToListAsync();
        }

        public async Task<List<OrganizationRegionAssignment>> GetByRegionIdAsync(int regionId)
        {
            return await _db.OrganizationRegionAssignments
                .Include(a => a.OrganizationUser)
                .Where(a => a.RegionId == regionId)
                .ToListAsync();
        }

        public async Task<bool> ExistsAsync(Guid organizationUserId, int regionId)
        {
            return await _db.OrganizationRegionAssignments
                .AnyAsync(a => a.OrganizationUserId == organizationUserId
                            && a.RegionId == regionId);
        }

        public async Task AddAsync(OrganizationRegionAssignment assignment)
        {
            await _db.OrganizationRegionAssignments.AddAsync(assignment);
        }

        public async Task RemoveAsync(Guid id)
        {
            var assignment = await _db.OrganizationRegionAssignments.FindAsync(id);
            if (assignment != null)
                _db.OrganizationRegionAssignments.Remove(assignment);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}
