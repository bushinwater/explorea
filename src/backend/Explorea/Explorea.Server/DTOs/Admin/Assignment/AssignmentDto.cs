namespace Explorea.API.DTOs.Admin.Assignment
{
    public class AssignmentDto
    {
        public Guid Id { get; set; }
        public Guid OrganizationUserId { get; set; }
        public string OrganizationUserName { get; set; } = null!;
        public string OrganizationUserEmail { get; set; } = null!;
        public Guid DestinationId { get; set; }
        public string DestinationName { get; set; } = null!;
        public DateTimeOffset AssignedAt { get; set; }
    }
}
