namespace Explorea.API.DTOs.Auth
{
    public class AuthResponseDto
    {
        public string? AccessToken { get; set; }
        public string? RefreshToken { get; set; }
        public bool NeedsInterests { get; set; }
        public bool NeedsProfileCompletion { get; set; }
        public string? SocialPendingToken { get; set; }
        public string? ProfileImageUrl { get; set; }
    }
}