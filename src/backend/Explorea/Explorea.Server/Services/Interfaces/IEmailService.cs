namespace Explorea.Server.Services.Interfaces
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string toEmail, string firstName, string verificationLink);
        Task SendForgotPasswordEmailAsync(string toEmail, string firstName, string resetLink);
        Task SendNewsletterEmailAsync(IEnumerable<string> toEmails, string subject, string htmlBody);
        Task SendAdminReportEmailAsync(string toEmail, Explorea.API.DTOs.Admin.AdminReportEmailData data);
        Task SendSavedItemDeletedEmailAsync(string toEmail, string firstName, string entityName);
        Task SendDeletedEntityReferenceEmailAsync(
            string toEmail,
            string firstName,
            string entityName,
            bool wasSaved,
            bool wasInPlanner,
            IEnumerable<string> plannerNotes);
        Task SendOwnerEntityUpdatedEmailAsync(
            string toEmail,
            string firstName,
            string entityType,
            string entityName,
            string actorName,
            IEnumerable<string> changedFields);

        Task SendReviewDeletedEmailAsync(
            string toEmail,
            string firstName,
            string entityName,
            string entityLink,
            string reason);
    }
}
