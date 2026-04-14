using Explorea.API.DTOs.Admin.Assignment;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminAssignmentService : IAdminAssignmentService
    {
        private readonly IOrganizationAssignmentRepository _assignmentRepo;
        private readonly IUserRepository _userRepo;

        public AdminAssignmentService(
            IOrganizationAssignmentRepository assignmentRepo,
            IUserRepository userRepo)
        {
            _assignmentRepo = assignmentRepo;
            _userRepo       = userRepo;
        }

        public async Task<List<AssignmentDto>> GetByUserIdAsync(Guid userId)
        {
            var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
            return assignments.Select(MapToDto).ToList();
        }

        public async Task<AssignmentDto> CreateAsync(CreateAssignmentDto dto, Guid assignedBy)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(assignedBy);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can assign destinations.");

            var alreadyExists = await _assignmentRepo.ExistsAsync(
                dto.OrganizationUserId, dto.DestinationId);

            if (alreadyExists)
                throw new Exception("This organization already has access to that destination.");

            var assignment = new OrganizationAssignment
            {
                Id                 = Guid.NewGuid(),
                OrganizationUserId = dto.OrganizationUserId,
                DestinationId      = dto.DestinationId,
                AssignedAt         = DateTimeOffset.UtcNow,
                AssignedBy         = assignedBy
            };

            await _assignmentRepo.AddAsync(assignment);
            await _assignmentRepo.SaveChangesAsync();

            var created = await _assignmentRepo.GetByIdAsync(assignment.Id);
            return MapToDto(created!);
        }

        public async Task DeleteAsync(Guid id, Guid currentUserId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
                throw new UnauthorizedAccessException("Only SuperAdmin can remove assignments.");

            await _assignmentRepo.RemoveAsync(id);
            await _assignmentRepo.SaveChangesAsync();
        }

        private static AssignmentDto MapToDto(OrganizationAssignment a) => new()
        {
            Id                    = a.Id,
            OrganizationUserId    = a.OrganizationUserId,
            OrganizationUserName  = a.OrganizationUser != null
                ? $"{a.OrganizationUser.FirstName} {a.OrganizationUser.LastName}"
                : "",
            OrganizationUserEmail = a.OrganizationUser?.Email ?? "",
            DestinationId         = a.DestinationId,
            DestinationName       = a.Destination?.Name ?? "",
            AssignedAt            = a.AssignedAt
        };
    }
}
