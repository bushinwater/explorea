using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAuthRepository : IBaseRepository<RefreshToken>
    {
        Task<RefreshToken?> GetRefreshTokenAsync(string tokenHash);
        Task CreateRefreshTokenAsync(RefreshToken token);
        Task RevokeRefreshTokenAsync(string tokenHash);

        Task<Role?> GetRoleByNameAsync(string roleName);

        Task<PasswordResetToken?> GetPasswordResetTokenAsync(string tokenHash);
        Task<PasswordResetToken> CreatePasswordResetTokenAsync(PasswordResetToken token);
        Task MarkPasswordResetTokenUsedAsync(string tokenHash);

        Task<EmailVerification> CreateEmailVerificationAsync(EmailVerification verification);
        Task<EmailVerification?> GetEmailVerificationAsync(string tokenHash);
        Task MarkEmailVerifiedAsync(string tokenHash);
    }
}