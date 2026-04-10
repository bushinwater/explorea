namespace Explorea.API.DTOs.Auth
{
    public class CompleteProfileDto
    {
        public string Gender { get; set; } = null!;
        public string DateOfBirth { get; set; } = null!; // "YYYY-MM-DD"
    }
}
