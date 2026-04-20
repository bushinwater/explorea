namespace Explorea.API.DTOs.Admin.Assignment
{
    public class CreateAssignmentDto
    {
        public Guid OrganizationUserId { get; set; }
        public Guid DestinationId { get; set; }
    }
}
