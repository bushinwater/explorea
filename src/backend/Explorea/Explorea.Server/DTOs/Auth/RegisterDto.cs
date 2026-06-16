using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Auth
{
    public class RegisterDto
    {
        [Required, StringLength(50, MinimumLength = 1)]
        public string FirstName { get; set; } = null!;

        [Required, StringLength(50, MinimumLength = 1)]
        public string LastName { get; set; } = null!;

        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = null!;

        // Length bound here is a sanity cap; complexity policy (digit, letter,
        // etc.) lives in AuthService.RegisterAsync so business rules stay in
        // one place.
        [Required, StringLength(128, MinimumLength = 8)]
        public string Password { get; set; } = null!;

        [Required, Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
        public string ConfirmPassword { get; set; } = null!;

        [StringLength(20)]
        public string? Gender { get; set; }

        public DateOnly? DateOfBirth { get; set; }
    }
}
