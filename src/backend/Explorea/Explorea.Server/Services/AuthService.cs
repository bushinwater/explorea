using System.Net;
using Explorea.API.DTOs.Auth;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly IAuthRepository _authRepository;
        private readonly PasswordHelper _passwordHelper;
        private readonly JwtHelper _jwtHelper;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        public AuthService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            PasswordHelper passwordHelper,
            JwtHelper jwtHelper,
            IConfiguration configuration,
            IEmailService emailService)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _passwordHelper = passwordHelper;
            _jwtHelper = jwtHelper;
            _configuration = configuration;
            _emailService = emailService;
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto, string? ipAddress, string? userAgent)
        {
            if (dto.Password != dto.ConfirmPassword)
                throw new Exception("Password and confirm password do not match.");

            var normalizedEmail = dto.Email.Trim().ToLower();

            var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail);
            if (existingUser != null)
                throw new Exception("User with this email already exists.");

            var userRole = await _authRepository.GetRoleByNameAsync("user");
            if (userRole == null)
                throw new Exception("Default role 'user' was not found in database.");

            var now = DateTimeOffset.UtcNow;

            var user = new User
            {
                Id = Guid.NewGuid(),
                FirstName = dto.FirstName.Trim(),
                LastName = dto.LastName.Trim(),
                Email = normalizedEmail,
                PasswordHash = _passwordHelper.HashPassword(dto.Password),
                RoleId = userRole.Id,
                TravelerRank = "explorer",
                TotalVisits = 0,
                MemberSince = now,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _userRepository.AddAsync(user);
            await _userRepository.SaveChangesAsync();

            user.Role = userRole;

            var accessToken = _jwtHelper.GenerateAccessToken(user);
            var refreshToken = _jwtHelper.GenerateRefreshToken();
            var refreshTokenHash = _jwtHelper.HashToken(refreshToken);

            var refreshTokenEntity = BuildRefreshTokenEntity(
                user.Id,
                refreshTokenHash,
                ipAddress,
                userAgent,
                now);

            await _authRepository.CreateRefreshTokenAsync(refreshTokenEntity);

            await CreateAndSendEmailVerificationAsync(user);

            return BuildAuthResponse(user, accessToken, refreshToken, true);
        }

        public async Task<AuthResponseDto> LoginAsync(LoginDto dto, string? ipAddress, string? userAgent)
        {
            var normalizedEmail = dto.Email.Trim().ToLower();
            var user = await _userRepository.GetByEmailAsync(normalizedEmail);

            if (user == null || string.IsNullOrWhiteSpace(user.PasswordHash))
                throw new Exception("Invalid email or password.");

            if (!user.IsActive)
                throw new Exception("User account is inactive.");

            var isPasswordValid = _passwordHelper.VerifyPassword(dto.Password, user.PasswordHash);
            if (!isPasswordValid)
                throw new Exception("Invalid email or password.");

            var now = DateTimeOffset.UtcNow;

            user.LastLoginAt = now;
            user.UpdatedAt = now;
            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            var accessToken = _jwtHelper.GenerateAccessToken(user);
            var refreshToken = _jwtHelper.GenerateRefreshToken();
            var refreshTokenHash = _jwtHelper.HashToken(refreshToken);

            var refreshTokenEntity = BuildRefreshTokenEntity(
                user.Id,
                refreshTokenHash,
                ipAddress,
                userAgent,
                now);

            await _authRepository.CreateRefreshTokenAsync(refreshTokenEntity);

            return BuildAuthResponse(user, accessToken, refreshToken, false);
        }

        public async Task<AuthResponseDto> RefreshAsync(string refreshToken, string? ipAddress, string? userAgent)
        {
            var tokenHash = _jwtHelper.HashToken(refreshToken);
            var existingToken = await _authRepository.GetRefreshTokenAsync(tokenHash);

            if (existingToken == null || existingToken.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new Exception("Invalid or expired refresh token.");

            await _authRepository.RevokeRefreshTokenAsync(tokenHash);

            var user = existingToken.User;
            var now = DateTimeOffset.UtcNow;

            var newAccessToken = _jwtHelper.GenerateAccessToken(user);
            var newRefreshToken = _jwtHelper.GenerateRefreshToken();
            var newRefreshTokenHash = _jwtHelper.HashToken(newRefreshToken);

            var refreshTokenEntity = BuildRefreshTokenEntity(
                user.Id,
                newRefreshTokenHash,
                ipAddress,
                userAgent,
                now);

            await _authRepository.CreateRefreshTokenAsync(refreshTokenEntity);

            return BuildAuthResponse(user, newAccessToken, newRefreshToken, false);
        }

        public async Task LogoutAsync(string refreshToken)
        {
            var tokenHash = _jwtHelper.HashToken(refreshToken);
            await _authRepository.RevokeRefreshTokenAsync(tokenHash);
        }

        public async Task VerifyEmailAsync(string token)
        {
            var decodedToken = WebUtility.UrlDecode(token);

            var tokenHash = _jwtHelper.HashToken(decodedToken);
            var verification = await _authRepository.GetEmailVerificationAsync(tokenHash);

            if (verification == null)
                throw new Exception("Invalid verification token.");

            if (verification.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new Exception("Verification token has expired.");

            var user = await _userRepository.GetByIdAsync(verification.UserId);
            if (user == null)
                throw new Exception("User not found.");

            if (user.EmailVerifiedAt != null)
                return;

            user.EmailVerifiedAt = DateTimeOffset.UtcNow;
            user.UpdatedAt = DateTimeOffset.UtcNow;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            await _authRepository.MarkEmailVerifiedAsync(tokenHash);
        }

        public async Task ResendVerificationEmailAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLower();
            var user = await _userRepository.GetByEmailAsync(normalizedEmail);

            if (user == null)
                throw new Exception("User with this email does not exist.");

            if (user.EmailVerifiedAt != null)
                throw new Exception("Email is already verified.");

            await CreateAndSendEmailVerificationAsync(user);
        }

        public async Task ForgotPasswordAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLower();
            var user = await _userRepository.GetByEmailAsync(normalizedEmail);

            if (user == null)
                throw new Exception("User with this email does not exist.");

            var rawToken = _jwtHelper.GenerateRefreshToken();
            var tokenHash = _jwtHelper.HashToken(rawToken);
            var now = DateTimeOffset.UtcNow;
            var expiryHours = int.Parse(_configuration["PasswordResetSettings:ExpiryHours"]!);

            var resetToken = new PasswordResetToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = tokenHash,
                ExpiresAt = now.AddHours(expiryHours),
                CreatedAt = now,
                CreatedBy = user.Id,
                UpdatedBy = user.Id
            };

            await _authRepository.CreatePasswordResetTokenAsync(resetToken);

            var frontendBaseUrl = _configuration["FrontendSettings:BaseUrl"]!;
            var resetLink = $"{frontendBaseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}";

            await _emailService.SendForgotPasswordEmailAsync(
                user.Email,
                user.FirstName,
                resetLink);
        }

        public async Task ResetPasswordAsync(string token, string newPassword)
        {
            var decodedToken = WebUtility.UrlDecode(token);
            var tokenHash = _jwtHelper.HashToken(decodedToken);

            var resetToken = await _authRepository.GetPasswordResetTokenAsync(tokenHash);

            if (resetToken == null)
                throw new Exception("Invalid password reset token.");

            if (resetToken.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new Exception("Password reset token has expired.");

            var user = await _userRepository.GetByIdAsync(resetToken.UserId);
            if (user == null)
                throw new Exception("User not found.");

            user.PasswordHash = _passwordHelper.HashPassword(newPassword);
            user.UpdatedAt = DateTimeOffset.UtcNow;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            await _authRepository.MarkPasswordResetTokenUsedAsync(tokenHash);
        }

        private async Task CreateAndSendEmailVerificationAsync(User user)
        {
            var rawToken = _jwtHelper.GenerateRefreshToken();
            var tokenHash = _jwtHelper.HashToken(rawToken);
            var now = DateTimeOffset.UtcNow;
            var expiryHours = int.Parse(_configuration["EmailVerificationSettings:ExpiryHours"]!);

            var verification = new EmailVerification
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Email = user.Email,
                TokenHash = tokenHash,
                ExpiresAt = now.AddHours(expiryHours),
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = user.Id,
                UpdatedBy = user.Id
            };

            await _authRepository.CreateEmailVerificationAsync(verification);

            var frontendBaseUrl = _configuration["FrontendSettings:BaseUrl"]!;
            var verificationLink = $"{frontendBaseUrl}/verify-email?token={Uri.EscapeDataString(rawToken)}";

            await _emailService.SendVerificationEmailAsync(
                user.Email,
                user.FirstName,
                verificationLink);
        }

        private RefreshToken BuildRefreshTokenEntity(
            Guid userId,
            string tokenHash,
            string? ipAddress,
            string? userAgent,
            DateTimeOffset now)
        {
            var refreshExpiryDays = int.Parse(_configuration["JwtSettings:RefreshTokenExpiryDays"]!);

            return new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TokenHash = tokenHash,
                ExpiresAt = now.AddDays(refreshExpiryDays),
                CreatedAt = now,
                CreatedByIp = ParseIpAddress(ipAddress),
                DeviceInfo = string.IsNullOrWhiteSpace(userAgent) ? null : userAgent,
                IsRevoked = false,
                CreatedBy = userId,
                UpdatedBy = userId
            };
        }

        private static IPAddress? ParseIpAddress(string? ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress))
                return null;

            return IPAddress.TryParse(ipAddress, out var parsedIp) ? parsedIp : null;
        }

        private static AuthResponseDto BuildAuthResponse(
            User user,
            string accessToken,
            string refreshToken,
            bool needsInterests)
        {
            return new AuthResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                NeedsInterests = needsInterests,
                User = new AuthUserDto
                {
                    Id = user.Id,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Email = user.Email,
                    Role = user.Role?.Name ?? "user",
                    TravelerRank = user.TravelerRank
                }
            };
        }
    }
}