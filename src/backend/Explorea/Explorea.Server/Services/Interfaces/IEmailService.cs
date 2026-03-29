namespace Explorea.Server.Services.Interfaces
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string toEmail, string firstName, string verificationLink);
    }
}