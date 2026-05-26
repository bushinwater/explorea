using Explorea.API.Models;

namespace Explorea.Server.Services.Interfaces
{
    public interface INewsletterService
    {
        Task<(bool Created, string Email)> SubscribeGuestAsync(string email);
        Task<bool> UpdateUserSubscriptionAsync(Guid userId, bool newsletter);
        Task<bool> UnsubscribeAsync(string email);
        Task<int> SendNewsletterAsync(string subject, string htmlBody);
        Task<int> SendTestNewsletterAsync();
        Task<bool> SyncUserSubscriptionAsync(User user);
    }
}
