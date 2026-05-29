namespace Explorea.API.DTOs.Admin
{
    public class OwnerSubmissionDocumentDto
    {
        public Guid Id { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string DocumentUrl { get; set; } = string.Empty;
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
