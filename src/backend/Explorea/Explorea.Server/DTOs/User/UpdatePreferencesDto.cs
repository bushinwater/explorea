namespace Explorea.API.DTOs.User
{
    public class UpdatePreferencesDto
    {
        public string Theme { get; set; } = null!;
        public string Language { get; set; } = null!;
        public bool NotificationsEnabled { get; set; }
    }
}