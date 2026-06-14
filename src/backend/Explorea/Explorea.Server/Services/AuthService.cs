using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
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
        private readonly INewsletterService _newsletterService;
        private readonly IMemoryCache _cache;

        private static string PendingTokenKey(string tokenHash)        => $"pendingreg:token:{tokenHash}";
        private static string PendingEmailKey(string email)            => $"pendingreg:email:{email}";
        private static string PendingSocialTokenKey(string tokenHash)  => $"pendingsocial:token:{tokenHash}";

        private record PendingSocialData(
            string Provider,
            string ProviderUserId,
            string Email,
            string FirstName,
            string LastName,
            string? ProfileImageUrl);

        public AuthService(
            IUserRepository userRepository,
            IAuthRepository authRepository,
            PasswordHelper passwordHelper,
            JwtHelper jwtHelper,
            IConfiguration configuration,
            IEmailService emailService,
            INewsletterService newsletterService,
            IMemoryCache cache)
        {
            _userRepository = userRepository;
            _authRepository = authRepository;
            _passwordHelper = passwordHelper;
            _jwtHelper = jwtHelper;
            _configuration = configuration;
            _emailService = emailService;
            _newsletterService = newsletterService;
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

            if (user.DeletedAt != null)
                throw new Exception("Account has been deleted. You can submit an appeal within 30 days of deletion.");

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

            return BuildAuthResponse(accessToken, refreshToken, false);
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

            return BuildAuthResponse(newAccessToken, newRefreshToken, false);
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

            var userRole = await _authRepository.GetRoleByNameAsync(RoleNames.Traveler);
            if (userRole == null)
                throw new Exception($"Default role '{RoleNames.Traveler}' was not found in database.");

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
            await _newsletterService.SyncUserSubscriptionAsync(user);

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

            return BuildAuthResponse(accessToken, refreshToken, true);
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

            // OAuth-only accounts (signed up via Google etc.) don't have a local
            // password to reset. Refuse early with a clear message instead of
            // sending a reset email that wouldn't work, and so the inbox-holder
            // doesn't accidentally end up with an unintended local password.
            // Code marker is read by the frontend to pick the right i18n key.
            if (user.PasswordHash == null)
                throw new Exception("OAUTH_NO_LOCAL_PASSWORD: Ovaj nalog koristi Google login — promenu lozinke uradi na Google nalogu.");

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

            // Defensive: ForgotPasswordAsync already blocks OAuth-only accounts
            // from receiving a reset email, but a stale token issued before the
            // account lost its password would still land here and otherwise
            // bypass VerifyPassword with a null hash.
            if (user.PasswordHash == null)
                throw new Exception("OAUTH_NO_LOCAL_PASSWORD: Ovaj nalog koristi Google login — promenu lozinke uradi na Google nalogu.");

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

        public async Task<AuthResponseDto> SocialLoginAsync(SocialLoginDto dto, string? ipAddress, string? userAgent)
        {
            var provider = dto.Provider.ToLower();
            string providerUserId, email, firstName, lastName;
            string? profileImageUrl = null;

            if (provider == "google")
            {
                var googleUser = await VerifyGoogleTokenAsync(dto.Token ?? throw new Exception("Google access token is missing."));
                providerUserId = googleUser.Id;
                email = googleUser.Email.Trim().ToLower();
                firstName = googleUser.GivenName ?? email.Split('@')[0];
                lastName = googleUser.FamilyName ?? "";
                profileImageUrl = googleUser.Picture;
            }
            else if (provider == "facebook")
            {
                var fbUser = await VerifyFacebookCodeAsync(dto.Code, dto.RedirectUri);
                providerUserId = fbUser.Id;
                email = (fbUser.Email ?? "").Trim().ToLower();
                firstName = fbUser.FirstName ?? fbUser.Name?.Split(' ')[0] ?? "";
                lastName = fbUser.LastName ?? (fbUser.Name?.Contains(' ') == true ? fbUser.Name.Substring(fbUser.Name.IndexOf(' ') + 1) : "");
            }
            else
            {
                throw new Exception("Unsupported provider.");
            }

            var now = DateTimeOffset.UtcNow;
            var isNewUser = false;

            // Check if we already have a linked account for this provider + providerUserId
            var authAccount = await _authRepository.GetAuthAccountAsync(provider, providerUserId);

            if (authAccount == null)
            {
                // No linked account — check if email already exists
                var existingUser = await _userRepository.GetByEmailAsync(email);

                if (existingUser == null)
                {
                    // Brand new user — store pending, require profile completion before creating in DB
                    var rawPendingToken = _jwtHelper.GenerateRefreshToken();
                    var pendingTokenHash = _jwtHelper.HashToken(rawPendingToken);
                    _cache.Set(
                        PendingSocialTokenKey(pendingTokenHash),
                        new PendingSocialData(provider, providerUserId, email, firstName, lastName, profileImageUrl),
                        TimeSpan.FromHours(1));

                    return new AuthResponseDto
                    {
                        SocialPendingToken = rawPendingToken,
                        NeedsProfileCompletion = true
                    };
                }

                // Email exists but no linked provider — link it now
                await _authRepository.CreateAuthAccountAsync(new UserAuthAccount
                {
                    Id = Guid.NewGuid(),
                    UserId = existingUser.Id,
                    Provider = provider,
                    ProviderUserId = providerUserId,
                    EmailAtProvider = email,
                    IsPrimary = false,
                    CreatedAt = now,
                    UpdatedAt = now,
                    CreatedBy = existingUser.Id,
                    UpdatedBy = existingUser.Id
                });

                authAccount = await _authRepository.GetAuthAccountAsync(provider, providerUserId);
            }

            var user = authAccount!.User;

            if (user.DeletedAt != null)
                throw new Exception("Account has been deleted. You can submit an appeal within 30 days of deletion.");

            if (!user.IsActive)
                throw new Exception("User account is inactive.");

            user.LastLoginAt = now;
            user.UpdatedAt = now;

            // Persist Google profile picture on first social login if not already set
            if (user.ProfileImageUrl == null && profileImageUrl != null)
                user.ProfileImageUrl = profileImageUrl;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            var accessToken = _jwtHelper.GenerateAccessToken(user);
            var refreshToken = _jwtHelper.GenerateRefreshToken();
            var refreshTokenHash = _jwtHelper.HashToken(refreshToken);

            await _authRepository.CreateRefreshTokenAsync(BuildRefreshTokenEntity(
                user.Id, refreshTokenHash, ipAddress, userAgent, now));

            return new AuthResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ProfileImageUrl = user.ProfileImageUrl,
            };
        }

        public async Task<AuthResponseDto> CompleteSocialAsync(SocialCompleteDto dto, string? ipAddress, string? userAgent)
        {
            var pendingTokenHash = _jwtHelper.HashToken(dto.PendingToken);
            if (!_cache.TryGetValue(PendingSocialTokenKey(pendingTokenHash), out PendingSocialData? pending) || pending == null)
                throw new Exception("Invalid or expired social registration token.");

            var existingUser = await _userRepository.GetByEmailAsync(pending.Email);
            if (existingUser != null)
                throw new Exception("User with this email already exists.");

            if (!DateOnly.TryParse(dto.DateOfBirth, out var dob))
                throw new Exception("Invalid date of birth.");

            var userRole = await _authRepository.GetRoleByNameAsync("traveler")
                ?? throw new Exception("Default role 'traveler' was not found in database.");

            var now = DateTimeOffset.UtcNow;

            var user = new User
            {
                Id            = Guid.NewGuid(),
                FirstName     = pending.FirstName,
                LastName      = pending.LastName.Length > 0 ? pending.LastName : "-",
                Email         = pending.Email,
                PasswordHash  = null,
                RoleId        = userRole.Id,
                Role          = userRole,
                TravelerRank  = "explorer",
                TotalVisits   = 0,
                MemberSince   = now,
                EmailVerifiedAt = now,
                IsActive      = true,
                Gender           = dto.Gender,
                DateOfBirth      = dob,
                ProfileImageUrl  = pending.ProfileImageUrl,
                CreatedAt     = now,
                UpdatedAt     = now
            };

            await _userRepository.AddAsync(user);
            await _userRepository.SaveChangesAsync();

            await _authRepository.CreateAuthAccountAsync(new UserAuthAccount
            {
                Id              = Guid.NewGuid(),
                UserId          = user.Id,
                Provider        = pending.Provider,
                ProviderUserId  = pending.ProviderUserId,
                EmailAtProvider = pending.Email,
                IsPrimary       = false,
                CreatedAt       = now,
                UpdatedAt       = now,
                CreatedBy       = user.Id,
                UpdatedBy       = user.Id
            });

            _cache.Remove(PendingSocialTokenKey(pendingTokenHash));

            var accessToken  = _jwtHelper.GenerateAccessToken(user);
            var refreshToken = _jwtHelper.GenerateRefreshToken();
            var refreshTokenHash = _jwtHelper.HashToken(refreshToken);

            await _authRepository.CreateRefreshTokenAsync(BuildRefreshTokenEntity(
                user.Id, refreshTokenHash, ipAddress, userAgent, now));

            return new AuthResponseDto
            {
                AccessToken     = accessToken,
                RefreshToken    = refreshToken,
                NeedsInterests  = true,
                ProfileImageUrl = user.ProfileImageUrl
            };
        }

        private async Task<User> CreateSocialUserAsync(string email, string firstName, string lastName, DateTimeOffset now)
        {
            var userRole = await _authRepository.GetRoleByNameAsync(RoleNames.Traveler)
                ?? throw new Exception($"Default role '{RoleNames.Traveler}' was not found in database.");

            var user = new User
            {
                Id = Guid.NewGuid(),
                FirstName = firstName,
                LastName = lastName.Length > 0 ? lastName : "-",
                Email = email,
                PasswordHash = null,
                RoleId = userRole.Id,
                Role = userRole,
                TravelerRank = "explorer",
                TotalVisits = 0,
                MemberSince = now,
                EmailVerifiedAt = now,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _userRepository.AddAsync(user);
            await _userRepository.SaveChangesAsync();
            await _newsletterService.SyncUserSubscriptionAsync(user);

            return user;
        }

        private async Task<GoogleUserInfo> VerifyGoogleTokenAsync(string accessToken)
        {
            using var http = new HttpClient();
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            var response = await http.GetAsync("https://www.googleapis.com/oauth2/v1/userinfo");

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                throw new Exception($"Invalid Google token. Status: {response.StatusCode}. Details: {body}");
            }

            var json = await response.Content.ReadAsStringAsync();
            var user = JsonSerializer.Deserialize<GoogleUserInfo>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (user == null || string.IsNullOrWhiteSpace(user.Id) || string.IsNullOrWhiteSpace(user.Email))
                throw new Exception("Could not read Google user info.");

            return user;
        }

        private record GoogleUserInfo(
            [property: JsonPropertyName("id")]          string  Id,
            [property: JsonPropertyName("email")]       string  Email,
            [property: JsonPropertyName("given_name")]  string? GivenName,
            [property: JsonPropertyName("family_name")] string? FamilyName,
            [property: JsonPropertyName("picture")]     string? Picture);

        private async Task<FacebookUserInfo> VerifyFacebookCodeAsync(string? code, string? redirectUri)
        {
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(redirectUri))
                throw new Exception("Facebook authorization code or redirect URI is missing.");

            var appId     = _configuration["SocialAuth:Facebook:AppId"]!;
            var appSecret = _configuration["SocialAuth:Facebook:AppSecret"]!;

            using var http = new HttpClient();

            // Exchange authorization code for access token
            var tokenUrl = $"https://graph.facebook.com/v19.0/oauth/access_token" +
                           $"?client_id={Uri.EscapeDataString(appId)}" +
                           $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                           $"&client_secret={Uri.EscapeDataString(appSecret)}" +
                           $"&code={Uri.EscapeDataString(code)}";

            var tokenResponse = await http.GetAsync(tokenUrl);
            if (!tokenResponse.IsSuccessStatusCode)
                throw new Exception("Failed to exchange Facebook code for access token.");

            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
            using var tokenDoc = JsonDocument.Parse(tokenJson);
            var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString();

            if (string.IsNullOrWhiteSpace(accessToken))
                throw new Exception("Facebook access token was empty.");

            // Fetch user info
            var userUrl = $"https://graph.facebook.com/me?fields=id,name,email,first_name,last_name&access_token={Uri.EscapeDataString(accessToken)}";
            var userResponse = await http.GetAsync(userUrl);

            if (!userResponse.IsSuccessStatusCode)
                throw new Exception("Failed to fetch Facebook user info.");

            var userJson = await userResponse.Content.ReadAsStringAsync();
            var user = JsonSerializer.Deserialize<FacebookUserInfo>(userJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (user == null || string.IsNullOrWhiteSpace(user.Id))
                throw new Exception("Could not read Facebook user info.");

            return user;
        }

        private record FacebookUserInfo(string Id, string? Name, string? Email, string? FirstName, string? LastName);

        private static IPAddress? ParseIpAddress(string? ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress))
                return null;

            return IPAddress.TryParse(ipAddress, out var parsedIp) ? parsedIp : null;
        }

        private static AuthResponseDto BuildAuthResponse(
            string accessToken,
            string refreshToken,
            bool needsInterests)
        {
            return new AuthResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                NeedsInterests = needsInterests
            };
        }
    }
}
