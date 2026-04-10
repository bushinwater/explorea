namespace Explorea.API.DTOs.Auth
{
    public class SocialLoginDto
    {
        public string Provider { get; set; } = null!; // "google" | "facebook"
        public string? Token { get; set; }       // Google: access token
        public string? Code { get; set; }        // Facebook: authorization code
        public string? RedirectUri { get; set; } // Facebook: must match dialog redirect_uri
    }
}
