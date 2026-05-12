using Explorea.API.DTOs.Admin.User;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/me")]
    [Authorize]
    public class AdminProfileController : ControllerBase
    {
        private readonly IUserRepository _userRepository;

        public AdminProfileController(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetAdminProfile()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(claim, out var userId))
                return Unauthorized(new { message = "Invalid token." });

            var user = await _userRepository.GetByIdWithAdminContextAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            var roleName = user.Role?.Name ?? "place_owner";

            return Ok(new AdminMeDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                RoleName = roleName,
                ProfileImageUrl = user.ProfileImageUrl,
                ManagedRegionId = user.ManagedRegionId,
                ManagedRegionName = user.ManagedRegion?.Name,
                CountryContext = roleName == "super_admin" ? "Srbija" : null,
            });
        }
    }
}
