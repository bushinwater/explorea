namespace Explorea.API.DTOs.User
{
    public class UpdateUserDto
    {
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string? ProfileImageUrl { get; set; }
        public string? Gender { get; set; }
        public DateOnly? DateOfBirth { get; set; }
    }
}