namespace Explorea.Server.DTOs
{
    public class SubmitAppealDto
    {
        public Guid UserId { get; set; }
        public string? Message { get; set; }
    }
}
