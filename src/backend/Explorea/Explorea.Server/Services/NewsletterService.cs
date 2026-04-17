using System.Net.Mail;
using Explorea.API.Models;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class NewsletterService : INewsletterService
    {
        private readonly INewsletterRepository _newsletterRepository;

        public NewsletterService(INewsletterRepository newsletterRepository)
        {
            _newsletterRepository = newsletterRepository;
        }

        public async Task<(bool Created, string Email)> SubscribeGuestAsync(string email)
        {
            var normalizedEmail = NormalizeEmail(email);
            var existingSubscription = await _newsletterRepository.GetByEmailAsync(normalizedEmail);

            if (existingSubscription != null)
                return (Created: false, Email: normalizedEmail);

            await _newsletterRepository.AddAsync(new Newsletter
            {
                Email = normalizedEmail
            });

            await _newsletterRepository.SaveChangesAsync();

            return (Created: true, Email: normalizedEmail);
        }

        private static string NormalizeEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Email is required.");

            var trimmed = email.Trim().ToLowerInvariant();

            try
            {
                var parsed = new MailAddress(trimmed);
                return parsed.Address.Trim().ToLowerInvariant();
            }
            catch
            {
                throw new Exception("Email format is invalid.");
            }
        }
    }
}
