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
        private readonly IEmailService _emailService;

        public NewsletterService(
            INewsletterRepository newsletterRepository,
            IUserRepository userRepository,
            IEmailService emailService)
        {
            _newsletterRepository = newsletterRepository;
            _userRepository = userRepository;
            _emailService = emailService;
        }

        public async Task<(bool Created, string Email)> SubscribeGuestAsync(string email)
        {
            var normalizedEmail = NormalizeEmail(email);
            var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail);
            var existing = await _newsletterRepository.GetByEmailAsync(normalizedEmail);

            if (existing != null)
            {
                if (!existing.Subscribed)
                {
                    existing.Subscribed = true;
                    await _newsletterRepository.SaveChangesAsync();
                }

                if (existingUser != null && !existingUser.Newsletter)
                {
                    existingUser.Newsletter = true;
                    existingUser.UpdatedAt = DateTimeOffset.UtcNow;
                    existingUser.UpdatedBy = existingUser.Id;
                    _userRepository.Update(existingUser);
                    await _userRepository.SaveChangesAsync();
                }

                return (Created: false, Email: normalizedEmail);
            }

            await _newsletterRepository.AddAsync(new Newsletter { Email = normalizedEmail, Subscribed = true });
            await _newsletterRepository.SaveChangesAsync();

            if (existingUser != null && !existingUser.Newsletter)
            {
                existingUser.Newsletter = true;
                existingUser.UpdatedAt = DateTimeOffset.UtcNow;
                existingUser.UpdatedBy = existingUser.Id;
                _userRepository.Update(existingUser);
                await _userRepository.SaveChangesAsync();
            }

            return (Created: true, Email: normalizedEmail);
        }

        public async Task<bool> UpdateUserSubscriptionAsync(Guid userId, bool newsletter)
        {
            var user = await _userRepository.GetByIdAsync(userId)
                ?? throw new Exception("User not found.");

            var normalizedEmail = NormalizeEmail(user.Email);
            var existing = await _newsletterRepository.GetByEmailAsync(normalizedEmail);

            if (existing != null)
            {
                existing.Subscribed = newsletter;
                await _newsletterRepository.SaveChangesAsync();
            }
            else if (newsletter)
            {
                await _newsletterRepository.AddAsync(new Newsletter { Email = normalizedEmail, Subscribed = true });
                await _newsletterRepository.SaveChangesAsync();
            }

            user.Newsletter = newsletter;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = userId;
            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();

            return user.Newsletter;
        }

        public async Task<int> SendNewsletterAsync(string subject, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(subject))
                throw new Exception("Newsletter subject is required.");

            if (string.IsNullOrWhiteSpace(htmlBody))
                throw new Exception("Newsletter body is required.");

            var recipients = await _newsletterRepository.GetAllEmailsAsync();

            if (recipients.Count == 0)
                throw new Exception("There are no newsletter subscribers.");

            await _emailService.SendNewsletterEmailAsync(
                recipients,
                subject.Trim(),
                htmlBody.Trim());

            return recipients.Count;
        }

        public async Task<bool> SyncUserSubscriptionAsync(User user)
        {
            var normalizedEmail = NormalizeEmail(user.Email);
            var isSubscribed = await _newsletterRepository.ExistsAsync(normalizedEmail);

            if (user.Newsletter == isSubscribed)
                return user.Newsletter;

            user.Newsletter = isSubscribed;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            user.UpdatedBy = user.Id;

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
