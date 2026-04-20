using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class OrganizationAssignmentRepository : IOrganizationAssignmentRepository
    {
        private readonly AppDbContext _db;

        public OrganizationAssignmentRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<OrganizationAssignment>> GetByUserIdAsync(Guid userId)
        {
            return await _db.OrganizationAssignments
                .Include(a => a.Destination)
                    .ThenInclude(d => d.City)
                .Where(a => a.OrganizationUserId == userId)
                .ToListAsync();
        }

        public async Task<OrganizationAssignment?> GetByIdAsync(Guid id)
        {
            return await _db.OrganizationAssignments
                .Include(a => a.OrganizationUser)
                .Include(a => a.Destination)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<bool> ExistsAsync(Guid organizationUserId, Guid destinationId)
        {
            return await _db.OrganizationAssignments
                .AnyAsync(a => a.OrganizationUserId == organizationUserId
                            && a.DestinationId == destinationId);
        }

        public async Task AddAsync(OrganizationAssignment assignment)
        {
            await _db.OrganizationAssignments.AddAsync(assignment);
        }

        public async Task RemoveAsync(Guid id)
        {
            var assignment = await _db.OrganizationAssignments.FindAsync(id);
            if (assignment != null)
                _db.OrganizationAssignments.Remove(assignment);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}
