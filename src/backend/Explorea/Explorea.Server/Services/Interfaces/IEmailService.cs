namespace Explorea.Server.Services.Interfaces
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string toEmail, string firstName, string verificationLink);
        Task SendForgotPasswordEmailAsync(string toEmail, string firstName, string resetLink);
        Task SendNewsletterEmailAsync(IEnumerable<string> toEmails, string subject, string htmlBody);
    }
}
