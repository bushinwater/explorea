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

        public async Task SendAdminReportEmailAsync(string toEmail, Explorea.API.DTOs.Admin.AdminReportEmailData data)
        {
            if (data.Topics.Count == 0)
                return;

            var periodLabel = data.PeriodEnd.Subtract(data.PeriodStart).TotalDays switch
            {
                <= 1  => "dnevni",
                <= 7  => "nedeljni",
                <= 14 => "dvonedeljni",
                _     => "mesecni",
            };

            var fromDate = data.PeriodStart.ToString("dd.MM.yyyy");
            var toDate   = data.PeriodEnd.ToString("dd.MM.yyyy");

            var subject  = $"Explorea admin izvestaj - {fromDate} do {toDate}";
            var htmlBody = BuildReportHtml(data, periodLabel, fromDate, toDate);

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        private static string BuildReportHtml(
            Explorea.API.DTOs.Admin.AdminReportEmailData data,
            string periodLabel,
            string fromDate,
            string toDate)
        {
            var sections = new System.Text.StringBuilder();
            var topics   = data.Topics;

            if (topics.Contains("weekly_summary"))
            {
                sections.Append(BuildSection(
                    "Nedeljni pregled",
                    new[]
                    {
                        Stat("Novi korisnici",         data.NewUsersCount,         "u ovom periodu"),
                        Stat("Nove recenzije",         data.NewReviewsCount,        "u ovom periodu"),
                        Stat("Recenzije na moderaciji",data.HiddenReviewsCount,     "ceka pregled"),
                        Stat("Novi dogadjaji",          data.NewEventsCount,         "u ovom periodu"),
                        Stat("Nadolazeci dogadjaji",    data.UpcomingEventsCount,    "u narednom periodu"),
                        Stat("Zahtevi na cekanju",     data.PendingPlacesCount,     "ceka odobravanje"),
                        Stat("Otvoreni tiketi",        data.OpenTicketsCount,       "otvoreno"),
                    }));
            }
            else
            {
                if (topics.Contains("reviews"))
                {
                    sections.Append(BuildSection(
                        "Recenzije i moderacija",
                        new[]
                        {
                            Stat("Nove recenzije",          data.NewReviewsCount,   "u ovom periodu"),
                            Stat("Recenzije na moderaciji", data.HiddenReviewsCount, "ceka pregled"),
                        }));
                }

                if (topics.Contains("events"))
                {
                    sections.Append(BuildSection(
                        "Dogadjaji i aktivnosti",
                        new[]
                        {
                            Stat("Novi dogadjaji",       data.NewEventsCount,      "u ovom periodu"),
                            Stat("Nadolazeci dogadjaji", data.UpcomingEventsCount, "u narednom periodu"),
                        }));
                }

                if (topics.Contains("system"))
                {
                    sections.Append(BuildSection(
                        "Sistemska upozorenja",
                        new[]
                        {
                            Stat("Zahtevi objekata na cekanju", data.PendingPlacesCount, "ceka odobravanje"),
                            Stat("Otvoreni support tiketi",     data.OpenTicketsCount,   "otvoreno"),
                        }));
                }
            }

            return $@"<!DOCTYPE html>
<html lang=""sr"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""></head>
<body style=""margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#0f1117;"">
    <tr><td align=""center"" style=""padding:32px 16px;"">
      <table width=""580"" cellpadding=""0"" cellspacing=""0"" style=""max-width:580px;width:100%;"">

        <!-- header -->
        <tr><td style=""background:#1a1d27;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #2a2d3a;"">
          <span style=""font-size:22px;font-weight:800;color:#6366f1;letter-spacing:-0.5px;"">Explorea</span>
          <span style=""font-size:13px;color:#8b8fa8;margin-left:10px;"">Admin izvestaj</span>
        </td></tr>

        <!-- greeting -->
        <tr><td style=""background:#1a1d27;padding:24px 32px 8px;"">
          <p style=""margin:0 0 6px;font-size:16px;font-weight:600;color:#e8e9f0;"">
            Zdravo, {WebUtility.HtmlEncode(data.FirstName)}!
          </p>
          <p style=""margin:0;font-size:13px;color:#8b8fa8;line-height:1.5;"">
            Ovo je tvoj {WebUtility.HtmlEncode(periodLabel)} izvestaj za period
            <strong style=""color:#a8aabc;"">{WebUtility.HtmlEncode(fromDate)} &ndash; {WebUtility.HtmlEncode(toDate)}</strong>.
          </p>
        </td></tr>

        <!-- sections -->
        {sections}

        <!-- footer -->
        <tr><td style=""background:#13151f;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #2a2d3a;"">
          <p style=""margin:0;font-size:12px;color:#5c5f72;line-height:1.6;"">
            Ovaj izvestaj je automatski generisan na osnovu tvojih podesavanja obavest&shy;enja.<br>
            Za promenu ucestalosti ili tema poseti <strong>Admin panel &rsaquo; Settings &rsaquo; Notifications</strong>.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";
        }

        private static string BuildSection(string title, IEnumerable<string> statRows)
        {
            var rows = string.Join("", statRows);
            return $@"
        <tr><td style=""background:#1a1d27;padding:20px 32px 0;"">
          <p style=""margin:0 0 12px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;"">{WebUtility.HtmlEncode(title)}</p>
          <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#12141e;border:1px solid #2a2d3a;border-radius:8px;overflow:hidden;"">
            {rows}
          </table>
        </td></tr>
        <tr><td style=""background:#1a1d27;padding:0 0 4px;""></td></tr>";
        }

        private static string Stat(string label, int value, string suffix)
        {
            var color = value == 0 ? "#5c5f72" : "#e8e9f0";
            var badge = value == 0
                ? $@"<span style=""color:#5c5f72;font-size:20px;font-weight:700;"">0</span>"
                : $@"<span style=""color:#6366f1;font-size:20px;font-weight:700;"">{value}</span>";

            return $@"
            <tr style=""border-bottom:1px solid #1e2130;"">
              <td style=""padding:12px 16px;"">
                <span style=""font-size:13px;color:{color};"">{WebUtility.HtmlEncode(label)}</span>
                <span style=""font-size:11px;color:#5c5f72;margin-left:6px;"">{WebUtility.HtmlEncode(suffix)}</span>
              </td>
              <td align=""right"" style=""padding:12px 16px;white-space:nowrap;"">
                {badge}
              </td>
            </tr>";
        }

        public async Task SendSavedItemDeletedEmailAsync(string toEmail, string firstName, string entityName)
        {
            await SendDeletedEntityReferenceEmailAsync(
                toEmail,
                firstName,
                entityName,
                wasSaved: true,
                wasInPlanner: false,
                plannerNotes: Array.Empty<string>());
        }

        public async Task SendDeletedEntityReferenceEmailAsync(
            string toEmail,
            string firstName,
            string entityName,
            bool wasSaved,
            bool wasInPlanner,
            IEnumerable<string> plannerNotes)
        {
            var safeName = WebUtility.HtmlEncode(entityName);
            var sourceText = (wasSaved, wasInPlanner) switch
            {
                (true, true) => "vasoj listi sacuvanih i planeru",
                (true, false) => "vasoj listi sacuvanih",
                (false, true) => "vasem planeru",
                _ => "vasem nalogu"
            };

            var notes = plannerNotes
                .Where(note => !string.IsNullOrWhiteSpace(note))
                .Select(note => note.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var notesBlock = notes.Count == 0
                ? string.Empty
                : $"<p>Napomena iz planera: \"{WebUtility.HtmlEncode(string.Join("; ", notes))}\"</p>";

            var subject = $"{entityName} je obrisan iz sistema";
            var htmlBody = $@"
                <html>
                    <body>
                        <p>Zdravo, {WebUtility.HtmlEncode(firstName)}!</p>
                        <p>{safeName} koji je bio u {sourceText} je obrisan iz sistema.</p>
                        {notesBlock}
                    </body>
                </html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendReviewDeletedEmailAsync(
            string toEmail,
            string firstName,
            string entityName,
            string entityLink,
            string reason)
        {
            var safeFirst  = WebUtility.HtmlEncode(firstName);
            var safeEntity = WebUtility.HtmlEncode(entityName);
            var safeReason = WebUtility.HtmlEncode(reason);

            var subject  = "Vaša recenzija je obrisana";
            var htmlBody = $@"<!DOCTYPE html>
<html lang=""sr"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""></head>
<body style=""margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#0f1117;"">
    <tr><td align=""center"" style=""padding:32px 16px;"">
      <table width=""560"" cellpadding=""0"" cellspacing=""0"" style=""max-width:560px;width:100%;"">

        <tr><td style=""background:#1a1d27;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #2a2d3a;"">
          <span style=""font-size:22px;font-weight:800;color:#6366f1;"">Explorea</span>
        </td></tr>

        <tr><td style=""background:#1a1d27;padding:28px 32px;"">
          <p style=""margin:0 0 12px;font-size:16px;font-weight:600;color:#e8e9f0;"">Zdravo, {safeFirst}!</p>
          <p style=""margin:0 0 16px;font-size:14px;color:#a8aabc;line-height:1.6;"">
            Vaša recenzija za <strong style=""color:#e8e9f0;"">{safeEntity}</strong> je obrisana od strane administratora.
          </p>
          <table width=""100%"" cellpadding=""0"" cellspacing=""0""
                 style=""background:#12141e;border:1px solid #2a2d3a;border-radius:8px;padding:16px 20px;margin-bottom:20px;"">
            <tr><td>
              <p style=""margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;"">Razlog brisanja</p>
              <p style=""margin:0;font-size:14px;color:#e8e9f0;line-height:1.5;"">{safeReason}</p>
            </td></tr>
          </table>
          <p style=""margin:0 0 20px;font-size:13px;color:#8b8fa8;"">
            Možete posetiti stranicu entiteta klikom na dugme ispod.
          </p>
          <a href=""{entityLink}"" style=""display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;"">
            Pogledaj stranicu
          </a>
        </td></tr>

        <tr><td style=""background:#13151f;border-radius:0 0 12px 12px;padding:16px 32px;border-top:1px solid #2a2d3a;"">
          <p style=""margin:0;font-size:11px;color:#5c5f72;"">
            Ovo je automatska poruka Explorea platforme.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendSubmittedEntityReviewedEmailAsync(
            string toEmail,
            string firstName,
            string entityType,
            string entityName,
            bool approved,
            string? rejectionReason)
        {
            var safeFirstName = WebUtility.HtmlEncode(firstName);
            var safeEntityType = WebUtility.HtmlEncode(entityType);
            var safeEntityName = WebUtility.HtmlEncode(entityName);
            var subject = approved
                ? $"{entityName} je odobren"
                : $"{entityName} je odbijen";

            var statusText = approved
                ? $"Vas {safeEntityType} \"{safeEntityName}\" je odobren i bice prikazan korisnicima."
                : $"Vas {safeEntityType} \"{safeEntityName}\" je odbijen.";

            var reasonBlock = approved
                ? string.Empty
                : $"<p>Razlog odbijanja: {WebUtility.HtmlEncode(rejectionReason ?? "Zahtev ne ispunjava uslove za objavu.")}</p>";

            var htmlBody = $@"
                <html>
                    <body>
                        <p>Zdravo, {safeFirstName}!</p>
                        <p>{statusText}</p>
                        {reasonBlock}
                    </body>
                </html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendOwnerEntityUpdatedEmailAsync(
            string toEmail,
            string firstName,
            string entityType,
            string entityName,
            string actorName,
            IEnumerable<string> changedFields)
        {
            var fields = changedFields
                .Where(field => !string.IsNullOrWhiteSpace(field))
                .Select(field => field.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (fields.Count == 0) return;

            var safeEntityName = WebUtility.HtmlEncode(entityName);
            var safeActorName = WebUtility.HtmlEncode(actorName);
            var subject = $"Vas {entityType} je izmenjen";
            var htmlBody = $@"
                <html>
                    <body>
                        <p>Zdravo, {WebUtility.HtmlEncode(firstName)}!</p>
                        <p>Vas {WebUtility.HtmlEncode(entityType)} ""{safeEntityName}"" je izmenjen od strane {safeActorName}.</p>
                        <p>Izmenjene su sledece stvari:</p>
                        <ul>
                            {string.Join("", fields.Select(field => $"<li>{WebUtility.HtmlEncode(field)}</li>"))}
                        </ul>
                    </body>
                </html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendAccountDeletedEmailAsync(string toEmail, string firstName, string appealLink)
        {
            var safeName = WebUtility.HtmlEncode(firstName);
            var subject = "Vaš nalog je obrisan";
            var htmlBody = $@"<!DOCTYPE html>
<html lang=""sr"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""></head>
<body style=""margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#0f1117;"">
    <tr><td align=""center"" style=""padding:32px 16px;"">
      <table width=""560"" cellpadding=""0"" cellspacing=""0"" style=""max-width:560px;width:100%;"">

        <tr><td style=""background:#1a1d27;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #2a2d3a;"">
          <span style=""font-size:22px;font-weight:800;color:#6366f1;"">Explorea</span>
        </td></tr>

        <tr><td style=""background:#1a1d27;padding:28px 32px;"">
          <p style=""margin:0 0 12px;font-size:16px;font-weight:600;color:#e8e9f0;"">Zdravo, {safeName}!</p>
          <p style=""margin:0 0 16px;font-size:14px;color:#a8aabc;line-height:1.6;"">
            Vaš nalog na platformi <strong style=""color:#e8e9f0;"">Explorea</strong> je obrisan od strane administratora.
          </p>
          <p style=""margin:0 0 20px;font-size:14px;color:#a8aabc;line-height:1.6;"">
            Ukoliko smatrate da je ovo bila greška, možete podneti apel u roku od <strong style=""color:#e8e9f0;"">30 dana</strong>.
            Nakon toga, nalog će biti trajno obrisan i apel više neće biti moguć.
          </p>
          <a href=""{appealLink}"" style=""
            display:inline-block;
            padding:12px 24px;
            background:#6366f1;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-size:14px;
            font-weight:600;
          "">Podnesi apel</a>
          <p style=""margin:24px 0 0;font-size:12px;color:#6b6d80;"">
            Ako dugme ne radi, kopiraj ovaj link u browser:<br/>
            <span style=""color:#a8aabc;word-break:break-all;"">{WebUtility.HtmlEncode(appealLink)}</span>
          </p>
        </td></tr>

        <tr><td style=""background:#12141e;border-radius:0 0 12px 12px;padding:16px 32px;border-top:1px solid #2a2d3a;"">
          <p style=""margin:0;font-size:12px;color:#6b6d80;"">Explorea · Platforma za turizam</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";
            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendOwnerReviewRequestEmailAsync(
            string toEmail,
            string firstName,
            string entityType,
            string entityName,
            string submittedByName)
        {
            var safeName = System.Net.WebUtility.HtmlEncode(firstName);
            var safeEntityType = System.Net.WebUtility.HtmlEncode(entityType);
            var safeEntityName = System.Net.WebUtility.HtmlEncode(entityName);
            var safeSubmittedBy = System.Net.WebUtility.HtmlEncode(submittedByName);
            var subject = $"Zahtev za {safeEntityType} na vašem objektu čeka vaše odobrenje";

            var htmlBody = $@"<!DOCTYPE html>
<html><body style=""margin:0;padding:0;background:#0d0f19;font-family:sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr><td align=""center"" style=""padding:32px 16px;"">
      <table width=""520"" cellpadding=""0"" cellspacing=""0"" style=""background:#181b27;border-radius:12px;overflow:hidden;"">
        <tr><td style=""background:#1e2130;padding:24px 32px;border-bottom:1px solid #2a2d3a;"">
          <span style=""font-size:22px;font-weight:700;color:#e2e8f0;"">Explorea</span>
        </td></tr>
        <tr><td style=""padding:32px;"">
          <p style=""margin:0 0 16px;font-size:15px;color:#cbd5e1;"">Zdravo, <strong>{safeName}</strong>.</p>
          <p style=""margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;"">
            Korisnik <strong>{safeSubmittedBy}</strong> je podneo zahtev za organizaciju {safeEntityType}a
            <strong>&bdquo;{safeEntityName}&ldquo;</strong> na vašem objektu.
          </p>
          <p style=""margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;"">
            Turistička organizacija je pregledala zahtev i prosleđuje vam ga na finalnu potvrdu.
            Prijavite se na Explorea admin panel da biste pregledali detalje i doneli odluku.
          </p>
        </td></tr>
        <tr><td style=""background:#12141e;border-radius:0 0 12px 12px;padding:16px 32px;border-top:1px solid #2a2d3a;"">
          <p style=""margin:0;font-size:12px;color:#6b6d80;"">Explorea · Platforma za turizam</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }

        public async Task SendCascadeDeletionEmailAsync(
            string toEmail,
            string firstName,
            string parentEntityType,
            string parentEntityName,
            IEnumerable<(string EntityType, string EntityName)> deletedItems)
        {
            var safeName = System.Net.WebUtility.HtmlEncode(firstName);
            var safeParentType = System.Net.WebUtility.HtmlEncode(parentEntityType);
            var safeParentName = System.Net.WebUtility.HtmlEncode(parentEntityName);
            var items = deletedItems.ToList();
            if (items.Count == 0) return;

            var subject = $"Obriseni su vasi unosi vezani za {parentEntityName}";
            var itemsHtml = string.Join("", items.Select(i =>
                $"<li style=\"margin:6px 0;color:#cbd5e1;\"><strong>{System.Net.WebUtility.HtmlEncode(i.EntityType)}:</strong> {System.Net.WebUtility.HtmlEncode(i.EntityName)}</li>"));

            var htmlBody = $@"<!DOCTYPE html>
<html><body style=""margin:0;padding:0;background:#0d0f19;font-family:sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr><td align=""center"" style=""padding:32px 16px;"">
      <table width=""560"" cellpadding=""0"" cellspacing=""0"" style=""background:#181b27;border-radius:12px;overflow:hidden;"">
        <tr><td style=""background:#1e2130;padding:24px 32px;border-bottom:1px solid #2a2d3a;"">
          <span style=""font-size:22px;font-weight:700;color:#e2e8f0;"">Explorea</span>
        </td></tr>
        <tr><td style=""padding:32px;"">
          <p style=""margin:0 0 16px;font-size:15px;color:#cbd5e1;"">Zdravo, <strong>{safeName}</strong>.</p>
          <p style=""margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;"">
            Obavestavamo vas da je {safeParentType} <strong>&bdquo;{safeParentName}&ldquo;</strong>
            obrisana, pa su zajedno sa njom obrisani i sledeci vasi unosi koji su bili vezani za nju:
          </p>
          <ul style=""margin:0 0 20px 20px;padding:0;font-size:14px;line-height:1.6;"">
            {itemsHtml}
          </ul>
          <p style=""margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;"">
            Obrisani unosi mogu biti vraceni u roku od 30 dana iz sekcije &bdquo;Obrisani&ldquo;
            u admin panelu. Posle 30 dana brisu se trajno.
          </p>
          <p style=""margin:16px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;"">
            Ako mislite da je ovo greska, kontaktirajte podrsku na
            <a href=""mailto:explorea2026@gmail.com"" style=""color:#6366f1;text-decoration:none;"">explorea2026@gmail.com</a>.
          </p>
        </td></tr>
        <tr><td style=""background:#12141e;border-radius:0 0 12px 12px;padding:16px 32px;border-top:1px solid #2a2d3a;"">
          <p style=""margin:0;font-size:12px;color:#6b6d80;"">Explorea · Platforma za turizam</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>";

            await SendNewsletterEmailAsync(new[] { toEmail }, subject, htmlBody);
        }
    }
}
