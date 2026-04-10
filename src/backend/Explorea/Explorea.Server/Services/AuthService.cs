using System.Net;
using Explorea.API.DTOs.Auth;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

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
        private readonly IMemoryCache _cache;

        private static string PendingTokenKey(string tokenHash)  => $"pendingreg:token:{tokenHash}";
        private static string PendingEmailKey(string email)      => $"pendingreg:email:{email}";

        public AuthService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            PasswordHelper passwordHelper,
            JwtHelper jwtHelper,
            IConfiguration configuration,
            IEmailService emailService,
            IMemoryCache cache)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _passwordHelper = passwordHelper;
            _jwtHelper = jwtHelper;
            _configuration = configuration;
            _emailService = emailService;
            _cache = cache;
        }

        public async Task RegisterAsync(RegisterDto dto)
        {
            if (dto.Password != dto.ConfirmPassword)
                throw new Exception("Password and confirm password do not match.");

            var normalizedEmail = dto.Email.Trim().ToLower();

            var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail);
            if (existingUser != null)
                throw new Exception("User with this email already exists.");

            // Also reject if there is already a pending (unverified) registration for this email
            if (_cache.TryGetValue(PendingEmailKey(normalizedEmail), out _))
                throw new Exception("User with this email already exists.");

            var pending = new PendingRegistrationData(
                FirstName:    dto.FirstName.Trim(),
                LastName:     dto.LastName.Trim(),
                Email:        normalizedEmail,
                PasswordHash: _passwordHelper.HashPassword(dto.Password),
                Gender:       string.IsNullOrWhiteSpace(dto.Gender) ? null : dto.Gender.Trim(),
                DateOfBirth:  dto.DateOfBirth);

            var rawToken = _jwtHelper.GenerateRefreshToken();
            var tokenHash = _jwtHelper.HashToken(rawToken);
            var expiryHours = int.Parse(_configuration["EmailVerificationSettings:ExpiryHours"]!);
            var expiry = TimeSpan.FromHours(expiryHours);

            _cache.Set(PendingTokenKey(tokenHash), pending, expiry);
            _cache.Set(PendingEmailKey(normalizedEmail), tokenHash, expiry);

            var frontendBaseUrl = _configuration["FrontendSettings:BaseUrl"]!;
            var verificationLink = $"{frontendBaseUrl}/verify-email?token={Uri.EscapeDataString(rawToken)}";

            await _emailService.SendVerificationEmailAsync(
                normalizedEmail,
                pending.FirstName,
                verificationLink);
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

            if (user.EmailVerifiedAt == null)
                throw new Exception("EMAIL_NOT_VERIFIED");

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

        public async Task<AuthResponseDto> VerifyEmailAsync(string token, string? ipAddress, string? userAgent)
        {
            var tokenHash = _jwtHelper.HashToken(token);

            if (!_cache.TryGetValue(PendingTokenKey(tokenHash), out PendingRegistrationData? pending) || pending == null)
                throw new Exception("Invalid or expired verification token.");

            // Guard against race condition (e.g. double-click on the link)
            var existingUser = await _userRepository.GetByEmailAsync(pending.Email);
            if (existingUser != null)
                throw new Exception("User with this email already exists.");

            var userRole = await _authRepository.GetRoleByNameAsync("user");
            if (userRole == null)
                throw new Exception("Default role 'user' was not found in database.");

            var now = DateTimeOffset.UtcNow;

            var user = new User
            {
                Id            = Guid.NewGuid(),
                FirstName     = pending.FirstName,
                LastName      = pending.LastName,
                Email         = pending.Email,
                PasswordHash  = pending.PasswordHash,
                RoleId        = userRole.Id,
                Role          = userRole,
                TravelerRank  = "explorer",
                TotalVisits   = 0,
                MemberSince   = now,
                EmailVerifiedAt = now,
                IsActive      = true,
                Gender        = pending.Gender,
                DateOfBirth   = pending.DateOfBirth,
                CreatedAt     = now,
                UpdatedAt     = now,
            };

            await _userRepository.AddAsync(user);
            await _userRepository.SaveChangesAsync();

            // Clean up cache
            _cache.Remove(PendingTokenKey(tokenHash));
            _cache.Remove(PendingEmailKey(pending.Email));

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

            return BuildAuthResponse(user, accessToken, refreshToken, true);
        }

        public async Task ResendVerificationEmailAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLower();

            if (!_cache.TryGetValue(PendingEmailKey(normalizedEmail), out string? oldTokenHash) || oldTokenHash == null)
                throw new Exception("No pending registration found for this email. The link may have expired.");

            if (!_cache.TryGetValue(PendingTokenKey(oldTokenHash), out PendingRegistrationData? pending) || pending == null)
                throw new Exception("No pending registration found for this email. The link may have expired.");

            // Remove old cache entries
            _cache.Remove(PendingTokenKey(oldTokenHash));
            _cache.Remove(PendingEmailKey(normalizedEmail));

            // Generate new token and store new entries
            var rawToken = _jwtHelper.GenerateRefreshToken();
            var newTokenHash = _jwtHelper.HashToken(rawToken);
            var expiryHours = int.Parse(_configuration["EmailVerificationSettings:ExpiryHours"]!);
            var expiry = TimeSpan.FromHours(expiryHours);

            _cache.Set(PendingTokenKey(newTokenHash), pending, expiry);
            _cache.Set(PendingEmailKey(normalizedEmail), newTokenHash, expiry);

            var frontendBaseUrl = _configuration["FrontendSettings:BaseUrl"]!;
            var verificationLink = $"{frontendBaseUrl}/verify-email?token={Uri.EscapeDataString(rawToken)}";

            await _emailService.SendVerificationEmailAsync(
                normalizedEmail,
                pending.FirstName,
                verificationLink);
        }

        public async Task<bool> CheckEmailExistsAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLower();
            var user = await _userRepository.GetByEmailAsync(normalizedEmail);
            return user != null;
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
            var tokenHash = _jwtHelper.HashToken(token);

            var resetToken = await _authRepository.GetPasswordResetTokenAsync(tokenHash);

            if (resetToken == null)
                throw new Exception("Invalid password reset token.");

            if (resetToken.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new Exception("Password reset token has expired.");

            var user = await _userRepository.GetByIdAsync(resetToken.UserId);
            if (user == null)
                throw new Exception("User not found.");

            if (_passwordHelper.VerifyPassword(newPassword, user.PasswordHash))
                throw new Exception("New password must be different from the current password.");

            user.PasswordHash = _passwordHelper.HashPassword(newPassword);
            user.UpdatedAt = DateTimeOffset.UtcNow;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            await _authRepository.MarkPasswordResetTokenUsedAsync(tokenHash);
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