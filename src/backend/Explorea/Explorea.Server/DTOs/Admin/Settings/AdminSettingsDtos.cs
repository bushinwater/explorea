
using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Admin.Settings
{
  public class AdminProfileDto
  {
      public Guid Id { get; set; }
      public string FirstName { get; set; } = string.Empty;
      public string LastName { get; set; } = string.Empty;
      public string FullName { get; set; } = string.Empty;
      public string Initials { get; set; } = string.Empty;
      public string Email { get; set; } = string.Empty;
      public string Role { get; set; } = string.Empty;
      public string RoleLabel { get; set; } = string.Empty;
      public string Region { get; set; } = string.Empty;
      public string Status { get; set; } = string.Empty;
      public DateTimeOffset MemberSince { get; set; }
      public string? ProfileImageUrl { get; set; }
  }
  
   public class AdminUpdateProfileDto
    {
        [Required, MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? ProfileImageUrl { get; set; }
    }

     public class AdminAppPreferencesDto
    {
        public string Theme { get; set; } = "system";
        public string Language { get; set; } = "sr";
    }

    public class AdminUpdateAppPreferencesDto
    {
        [Required, MaxLength(20)]
        public string Theme { get; set; } = "system";

        [Required, MaxLength(10)]
        public string Language { get; set; } = "sr";
    }

    public class AdminNotificationsDto
    {
        public bool NotificationsEnabled { get; set; }
    }

    public class AdminUpdateNotificationsDto
    {
        public bool NotificationsEnabled { get; set; }
    }
}