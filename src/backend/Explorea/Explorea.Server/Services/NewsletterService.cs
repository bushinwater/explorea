using System.Net.Mail;
using System.Net;
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
        private readonly IConfiguration _configuration;

        public NewsletterService(
            INewsletterRepository newsletterRepository,
            IUserRepository userRepository,
            IEmailService emailService,
            IConfiguration configuration)
        {
            _newsletterRepository = newsletterRepository;
            _userRepository = userRepository;
            _emailService = emailService;
            _configuration = configuration;
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

        public async Task<bool> UnsubscribeAsync(string email)
        {
            var normalizedEmail = NormalizeEmail(email);
            var existing = await _newsletterRepository.GetByEmailAsync(normalizedEmail);
            var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail);

            var changed = false;

            if (existing != null && existing.Subscribed)
            {
                existing.Subscribed = false;
                await _newsletterRepository.SaveChangesAsync();
                changed = true;
            }

            if (existingUser != null && existingUser.Newsletter)
            {
                existingUser.Newsletter = false;
                existingUser.UpdatedAt = DateTimeOffset.UtcNow;
                existingUser.UpdatedBy = existingUser.Id;
                _userRepository.Update(existingUser);
                await _userRepository.SaveChangesAsync();
                changed = true;
            }

            return changed;
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

            foreach (var recipient in recipients)
            {
                await _emailService.SendNewsletterEmailAsync(
                    new[] { recipient },
                    subject.Trim(),
                    AddUnsubscribeSection(htmlBody.Trim(), recipient));
            }

            return recipients.Count;
        }

        public async Task<int> SendTestNewsletterAsync()
        {
            const string subject = "Explorea newsletter - preporuke za ovu nedelju";
            var htmlBody = @"
                <html>
                    <body style='font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;'>
                        <h2 style='color:#0f766e;'>Explorea preporuke za ovu nedelju</h2>
                        <p>Zdravo,</p>
                        <p>Pripremili smo nekoliko ideja za sledece putovanje: nove destinacije, dogadjaje i aktivnosti koje vredi sacuvati.</p>
                        <p>
                            <a href='https://explorea.local' style='display:inline-block;padding:12px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;'>
                                Pogledaj preporuke
                            </a>
                        </p>
                        <p>Hvala sto pratis Explorea novosti.</p>
                    </body>
                </html>";

            return await SendNewsletterAsync(subject, htmlBody);
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

        private string AddUnsubscribeSection(string htmlBody, string recipientEmail)
        {
            var unsubscribeLink = BuildUnsubscribeLink(recipientEmail);
            var encodedLink = WebUtility.HtmlEncode(unsubscribeLink);

            var unsubscribeSection = $@"
                <hr style='border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;' />
                <p style='font-size:13px;color:#6b7280;'>Ako vise ne zelis da primas Explorea newsletter, mozes se odjaviti klikom na dugme ispod.</p>
                <p>
                    <a href='{encodedLink}' style='display:inline-block;padding:10px 16px;background:#374151;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;'>
                        Unsubscribe
                    </a>
                </p>";

            if (htmlBody.Contains("{{unsubscribeUrl}}", StringComparison.OrdinalIgnoreCase))
                return htmlBody.Replace("{{unsubscribeUrl}}", encodedLink, StringComparison.OrdinalIgnoreCase);

            var bodyEndIndex = htmlBody.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyEndIndex >= 0)
                return htmlBody.Insert(bodyEndIndex, unsubscribeSection);

            return htmlBody + unsubscribeSection;
        }

        private string BuildUnsubscribeLink(string recipientEmail)
        {
            var configuredBaseUrl = _configuration["BackendSettings:BaseUrl"]
                ?? _configuration["AppSettings:ApiBaseUrl"]
                ?? "http://localhost:5000";

            var baseUrl = configuredBaseUrl.TrimEnd('/');
            return $"{baseUrl}/api/newsletter/unsubscribe?email={Uri.EscapeDataString(recipientEmail)}";
        }
    }
}
