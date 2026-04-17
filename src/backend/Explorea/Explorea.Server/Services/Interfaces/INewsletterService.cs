namespace Explorea.Server.Services.Interfaces
{
    public interface INewsletterService
    {
        Task<(bool Created, string Email)> SubscribeGuestAsync(string email);
        Task<bool> UpdateUserSubscriptionAsync(Guid userId, bool newsletter);
    }
}
