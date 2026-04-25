using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class AuthRepository : BaseRepository<RefreshToken>, IAuthRepository
    {
        public AuthRepository(AppDbContext db) : base(db) { }

        public async Task<RefreshToken?> GetRefreshTokenAsync(string tokenHash)
        {
            return await _db.RefreshTokens
                .Include(t => t.User).ThenInclude(u => u.Role)
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && !t.IsRevoked);
        }

        public async Task RevokeRefreshTokenAsync(string tokenHash)
        {
            var token = await _db.RefreshTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

            if (token != null)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

        public async Task<PasswordResetToken?> GetPasswordResetTokenAsync(string tokenHash)
        {
            return await _db.PasswordResetTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UsedAt == null);
        }

        public async Task<PasswordResetToken> CreatePasswordResetTokenAsync(PasswordResetToken token)
        {
            await _db.PasswordResetTokens.AddAsync(token);
            await _db.SaveChangesAsync();
            return token;
        }

        public async Task MarkPasswordResetTokenUsedAsync(string tokenHash)
        {
            var token = await _db.PasswordResetTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

            if (token != null)
            {
                token.UsedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

        public async Task<EmailVerification> CreateEmailVerificationAsync(EmailVerification verification)
        {
            await _db.EmailVerifications.AddAsync(verification);
            await _db.SaveChangesAsync();
            return verification;
        }

        public async Task<EmailVerification?> GetEmailVerificationAsync(string tokenHash)
        {
            return await _db.EmailVerifications
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.VerifiedAt == null);
        }

        public async Task MarkEmailVerifiedAsync(string tokenHash)
        {
            var verification = await _db.EmailVerifications
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

            if (verification != null)
            {
                verification.VerifiedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

        public async Task CreateRefreshTokenAsync(RefreshToken token)
        {
            await _db.RefreshTokens.AddAsync(token);
            await _db.SaveChangesAsync();
        }

        public async Task<Role?> GetRoleByNameAsync(string roleName)
        {
            return await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
        }

        public async Task<UserAuthAccount?> GetAuthAccountAsync(string provider, string providerUserId)
        {
            return await _db.UserAuthAccounts
                .Include(a => a.User)
                .FirstOrDefaultAsync(a => a.Provider == provider && a.ProviderUserId == providerUserId);
        }

        public async Task CreateAuthAccountAsync(UserAuthAccount account)
        {
            await _db.UserAuthAccounts.AddAsync(account);
            await _db.SaveChangesAsync();
        }
    }
}