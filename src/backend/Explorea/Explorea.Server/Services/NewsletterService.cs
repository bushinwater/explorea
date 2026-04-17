using System.Net.Mail;
using Explorea.API.Models;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class NewsletterService : INewsletterService
    {
        private readonly INewsletterRepository _newsletterRepository;
        private readonly IUserRepository _userRepository;

        public NewsletterService(
            INewsletterRepository newsletterRepository,
            IUserRepository userRepository)
        {
            _newsletterRepository = newsletterRepository;
            _userRepository = userRepository;
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

        public async Task<bool> UpdateUserSubscriptionAsync(Guid userId, bool newsletter)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            var normalizedEmail = NormalizeEmail(user.Email);
            var existingSubscription = await _newsletterRepository.GetByEmailAsync(normalizedEmail);

            if (newsletter)
            {
                if (existingSubscription == null)
                {
                    await _newsletterRepository.AddAsync(new Newsletter
                    {
                        Email = normalizedEmail
                    });

                    await _newsletterRepository.SaveChangesAsync();
                }
            }
            else if (existingSubscription != null)
            {
                _newsletterRepository.Remove(existingSubscription);
                await _newsletterRepository.SaveChangesAsync();
            }

            user.Newsletter = newsletter;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = userId;

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            return user.Newsletter;
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
