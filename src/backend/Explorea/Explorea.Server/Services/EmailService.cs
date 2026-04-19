using System.Net;
using System.Net.Mail;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendVerificationEmailAsync(string toEmail, string firstName, string verificationLink)
        {
            var smtpSection = _configuration.GetSection("SmtpSettings");

            var host = smtpSection["Host"];
            var port = int.Parse(smtpSection["Port"]!);
            var username = smtpSection["Username"];
            var password = smtpSection["Password"];
            var fromEmail = smtpSection["FromEmail"];
            var fromName = smtpSection["FromName"];
            var enableSsl = bool.Parse(smtpSection["EnableSsl"]!);

            if (string.IsNullOrWhiteSpace(host) ||
                string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password) ||
                string.IsNullOrWhiteSpace(fromEmail))
            {
                throw new Exception("SMTP settings are not configured properly.");
            }

            using var message = new MailMessage();
            message.From = new MailAddress(fromEmail, fromName);
            message.To.Add(toEmail);
            message.Subject = "Potvrda email adrese";
            message.IsBodyHtml = true;
            message.Body = $@"
                <html>
                    <body>
                        <p>Zdravo, {firstName}!</p>
                        <p>Hvala na registraciji. Klikni na dugme ispod da verifikuješ svoj nalog:</p>
                        <p>
                            <a href='{verificationLink}' style='
                                display:inline-block;
                                padding:12px 20px;
                                background:#2563eb;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:8px;
                                font-weight:bold;
                            '>Verifikuj nalog</a>
                        </p>
                        <p>Ako dugme ne radi, kopiraj ovaj link u browser:</p>
                        <p>{verificationLink}</p>
                    </body>
                </html>";

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            await client.SendMailAsync(message);
        }

        public async Task SendForgotPasswordEmailAsync(string toEmail, string firstName, string resetLink)
        {
            var smtpSection = _configuration.GetSection("SmtpSettings");

            var host = smtpSection["Host"];
            var port = int.Parse(smtpSection["Port"]!);
            var username = smtpSection["Username"];
            var password = smtpSection["Password"];
            var fromEmail = smtpSection["FromEmail"];
            var fromName = smtpSection["FromName"];
            var enableSsl = bool.Parse(smtpSection["EnableSsl"]!);

            if (string.IsNullOrWhiteSpace(host) ||
                string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password) ||
                string.IsNullOrWhiteSpace(fromEmail))
            {
                throw new Exception("SMTP settings are not configured properly.");
            }

            using var message = new MailMessage();
            message.From = new MailAddress(fromEmail, fromName);
            message.To.Add(toEmail);
            message.Subject = "Reset lozinke";
            message.IsBodyHtml = true;
            message.Body = $@"
                <html>
                    <body>
                        <p>Zdravo, {firstName}!</p>
                        <p>Primili smo zahtev za reset lozinke. Klikni na dugme ispod da postaviš novu lozinku:</p>
                        <p>
                            <a href='{resetLink}' style='
                                display:inline-block;
                                padding:12px 20px;
                                background:#dc2626;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:8px;
                                font-weight:bold;
                            '>Resetuj lozinku</a>
                        </p>
                        <p>Ako nisi ti tražio reset lozinke, slobodno ignoriši ovu poruku.</p>
                        <p>Ako dugme ne radi, kopiraj ovaj link u browser:</p>
                        <p>{resetLink}</p>
                    </body>
                </html>";

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            await client.SendMailAsync(message);
        }

        public async Task SendNewsletterEmailAsync(IEnumerable<string> toEmails, string subject, string htmlBody)
        {
            var smtpSection = _configuration.GetSection("SmtpSettings");

            var host = smtpSection["Host"];
            var port = int.Parse(smtpSection["Port"]!);
            var username = smtpSection["Username"];
            var password = smtpSection["Password"];
            var fromEmail = smtpSection["FromEmail"];
            var fromName = smtpSection["FromName"];
            var enableSsl = bool.Parse(smtpSection["EnableSsl"]!);

            if (string.IsNullOrWhiteSpace(host) ||
                string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password) ||
                string.IsNullOrWhiteSpace(fromEmail))
            {
                throw new Exception("SMTP settings are not configured properly.");
            }

            var recipients = toEmails
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToLowerInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (recipients.Count == 0)
                throw new Exception("There are no valid newsletter recipients.");

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            foreach (var email in recipients)
            {
                using var message = new MailMessage();
                message.From = new MailAddress(fromEmail, fromName);
                message.To.Add(email);
                message.Subject = subject;
                message.IsBodyHtml = true;
                message.Body = htmlBody;

                await client.SendMailAsync(message);
            }
        }
    }
}
