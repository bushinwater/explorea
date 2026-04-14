using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IOrganizationAssignmentRepository
    {
        Task<List<OrganizationAssignment>> GetByUserIdAsync(Guid userId);
        Task<OrganizationAssignment?> GetByIdAsync(Guid id);
        Task<bool> ExistsAsync(Guid organizationUserId, Guid destinationId);
        Task AddAsync(OrganizationAssignment assignment);
        Task RemoveAsync(Guid id);
        Task<int> SaveChangesAsync();
    }
}
