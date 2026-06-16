using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Auth
{
    public class LoginDto
    {
        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = null!;

        [Required, StringLength(128, MinimumLength = 1)]
        public string Password { get; set; } = null!;
    }
}
