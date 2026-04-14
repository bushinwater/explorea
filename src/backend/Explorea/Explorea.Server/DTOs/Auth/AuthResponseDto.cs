namespace Explorea.API.DTOs.Auth
{
    public class AuthResponseDto
    {
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
        public bool NeedsInterests { get; set; }
        public bool NeedsProfileCompletion { get; set; }
    }
}