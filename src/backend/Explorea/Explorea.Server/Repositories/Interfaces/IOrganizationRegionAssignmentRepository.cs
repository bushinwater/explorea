using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IOrganizationRegionAssignmentRepository
    {
        Task<List<OrganizationRegionAssignment>> GetByUserIdAsync(Guid userId);
        Task<List<OrganizationRegionAssignment>> GetByRegionIdAsync(int regionId);
        Task<bool> ExistsAsync(Guid organizationUserId, int regionId);
        Task AddAsync(OrganizationRegionAssignment assignment);
        Task RemoveAsync(Guid id);
        Task<int> SaveChangesAsync();
    }
}
