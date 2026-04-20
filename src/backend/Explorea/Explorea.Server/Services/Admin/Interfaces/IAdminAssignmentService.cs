using Explorea.API.DTOs.Admin.Assignment;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminAssignmentService
    {
        Task<List<AssignmentDto>> GetByUserIdAsync(Guid userId);

        Task<AssignmentDto> CreateAsync(CreateAssignmentDto dto, Guid assignedBy);

        Task DeleteAsync(Guid id, Guid currentUserId);
    }
}
