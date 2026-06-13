namespace Explorea.API.DTOs.Admin.User
{
    public class AdminMeDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string RoleName { get; set; } = null!;
        public string? ProfileImageUrl { get; set; }
        public int? ManagedRegionId { get; set; }
        public string? ManagedRegionName { get; set; }
        public string? CountryContext { get; set; }
        /// <summary>
        /// User's home country id — used by admin create modals to pre-select the
        /// country dropdown so super_admin doesn't have to pick it manually.
        /// </summary>
        public int? CountryId { get; set; }
    }
}
