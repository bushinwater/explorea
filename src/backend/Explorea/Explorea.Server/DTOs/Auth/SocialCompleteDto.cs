namespace Explorea.API.DTOs.Auth
{
    public class SocialCompleteDto
    {
        public string PendingToken { get; set; } = null!;
        public string Gender { get; set; } = null!;
        public string DateOfBirth { get; set; } = null!; // "YYYY-MM-DD"
    }
}
