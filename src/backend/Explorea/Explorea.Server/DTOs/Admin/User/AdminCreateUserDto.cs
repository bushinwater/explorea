namespace Explorea.API.DTOs.Admin.User
{
    public class AdminCreateUserDto
    {
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = null!;
        public string? Region { get; set; }
        public string? Gender { get; set; }
        public int? Age { get; set; }
        public string Status { get; set; } = "active";
    }
}
