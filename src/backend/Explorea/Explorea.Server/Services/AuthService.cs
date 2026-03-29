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

        public AuthService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            PasswordHelper passwordHelper,
            JwtHelper jwtHelper,
            IConfiguration configuration)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _passwordHelper = passwordHelper;
            _jwtHelper = jwtHelper;
            _configuration = configuration;
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