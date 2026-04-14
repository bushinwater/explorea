using Explorea.API.DTOs.Auth;

namespace Explorea.Server.Services.Interfaces
{
    public interface IAuthService
    {
        Task RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto> LoginAsync(LoginDto dto, string? ipAddress, string? userAgent);
        Task<AuthResponseDto> RefreshAsync(string refreshToken, string? ipAddress, string? userAgent);
        Task LogoutAsync(string refreshToken);

        Task<AuthResponseDto> VerifyEmailAsync(string token, string? ipAddress, string? userAgent);
        Task ResendVerificationEmailAsync(string email);

        Task<bool> CheckEmailExistsAsync(string email);
        Task ForgotPasswordAsync(string email);
        Task ResetPasswordAsync(string token, string newPassword);

        Task<AuthResponseDto> SocialLoginAsync(SocialLoginDto dto, string? ipAddress, string? userAgent);
    }
}