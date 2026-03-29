using Explorea.API.DTOs.Auth;

namespace Explorea.Server.Services.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto dto, string? ipAddress, string? userAgent);
        Task<AuthResponseDto> LoginAsync(LoginDto dto, string? ipAddress, string? userAgent);
        Task<AuthResponseDto> RefreshAsync(string refreshToken, string? ipAddress, string? userAgent);
        Task LogoutAsync(string refreshToken);

        Task VerifyEmailAsync(string token);
        Task ResendVerificationEmailAsync(string email);
    }
}