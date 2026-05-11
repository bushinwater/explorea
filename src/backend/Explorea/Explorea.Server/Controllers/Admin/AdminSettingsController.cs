using Explorea.API.DTOs.Admin.Settings;
using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Security.Claims;


namespace Explorea.Server.Controllers.Admin
{
  [ApiController]
  [Route("api/admin/settings")]
  [Authorize]
  public class AdminSettingsController : ControllerBase
  {
    private readonly AppDbContext _db;

    public AdminSettingsController(AppDbContext db) 
    {
      _db = db;
    }
    
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var user = await _db.Users
        .AsNoTracking()
        .Include(u => u.Role)
        .Include(u => u.ManagedRegion)
        .FirstOrDefaultAsync(u => u.Id == userId.Value);

      if(user == null) return NotFound(new {message = "User not found."});

      return Ok(MapProfile(user));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] AdminUpdateProfileDto dto)
    {
      if(!ModelState.IsValid) return ValidationProblem(ModelState);

      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var user = await _db.Users
        .Include(u => u.Role)
        .Include(u => u.ManagedRegion)
        .FirstOrDefaultAsync(u => u.Id == userId.Value);

      if(user == null) return NotFound(new {message = "User not found."});

      var normalizedEmail = dto.Email.Trim();

      var emailTaken = await _db.Users.AnyAsync(u =>
        u.Id != user.Id 
        && u.Email.ToLower() == normalizedEmail.ToLower()
      );  

      if(emailTaken) return BadRequest(new {message = "Email is already in use."});

      user.FirstName = dto.FirstName.Trim();
      user.LastName = dto.LastName.Trim();
      user.Email = normalizedEmail;
      user.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl)
        ? null
        : dto.ProfileImageUrl.Trim();
      user.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(MapProfile(user));
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var preferences = await GetOrCreatePreferences(userId.Value);

      return Ok(new AdminAppPreferencesDto
      {
        Theme = preferences.Theme,
        Language = preferences.Language
      });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] AdminUpdateAppPreferencesDto dto)
    {
      if(!ModelState.IsValid) return ValidationProblem(ModelState);

      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var preferences = await GetOrCreatePreferences(userId.Value);

      preferences.Theme = dto.Theme.Trim();
      preferences.Language = dto.Language.Trim();
      preferences.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(new AdminAppPreferencesDto
      {
        Theme = preferences.Theme,
        Language = preferences.Language
      });
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var preferences = await GetOrCreatePreferences(userId.Value);

      return Ok(new AdminNotificationsDto
      {
        NotificationsEnabled = preferences.NotificationsEnabled
      });
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotifications([FromBody] AdminUpdateNotificationsDto dto)
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var preferences = await GetOrCreatePreferences(userId.Value);

      preferences.NotificationsEnabled = dto.NotificationsEnabled;
      preferences.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(new AdminNotificationsDto
      {
        NotificationsEnabled = preferences.NotificationsEnabled
      });
    }

    private async Task<UserPreferences> GetOrCreatePreferences(Guid userId)
    {
       var preferences = await _db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

      if (preferences != null) return preferences;

      preferences = new UserPreferences
      {
          Id = Guid.NewGuid(),
          UserId = userId,
          Theme = "system",
          Language = "sr",
          NotificationsEnabled = true,
          CreatedAt = DateTimeOffset.UtcNow,
          UpdatedAt = DateTimeOffset.UtcNow
      };

      _db.UserPreferences.Add(preferences);
      await _db.SaveChangesAsync();

      return preferences;
    }

    private static AdminProfileDto MapProfile(User user)
    {
      var firstName = user.FirstName.Trim();
      var lastName = user.LastName.Trim();
      var fullName = $"{firstName} {lastName}".Trim();

      return new AdminProfileDto
      {
          Id = user.Id,
          FirstName = firstName,
          LastName = lastName,
          FullName = fullName,
          Initials = GetInitials(firstName, lastName),
          Email = user.Email,
          Role = NormalizeRole(user.Role.Name),
          RoleLabel = FormatRoleLabel(user.Role.Name),
          Region = user.ManagedRegion?.Name ?? "Sve regije",
          Status = user.IsActive ? "Active" : "Inactive",
          MemberSince = user.MemberSince,
          ProfileImageUrl = user.ProfileImageUrl
      };
    }

    private static string FormatRoleLabel(string role)
    {
      return NormalizeRole(role) switch
      {
          "super_admin" => "Super Admin",
          "tourist_organization" => "Tourist Organization",
          "place_owner" => "Place Owner",
          _ => role
      };
    }

    private static string NormalizeRole(string role)
    {
      return role.Trim().ToLowerInvariant().Replace(" ", "_");
    }

    private static string GetInitials(string firstName, string lastName)
    {
      var firstInitial = string.IsNullOrWhiteSpace(firstName) ? "" : firstName[0].ToString();
      var lastInitial = string.IsNullOrWhiteSpace(lastName) ? "" : lastName[0].ToString();

      var initials = $"{firstInitial}{lastInitial}".ToUpperInvariant();
      return string.IsNullOrWhiteSpace(initials) ? "AD" : initials;
    }

    private Guid? TryGetCurrentUserId()
    {
      var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
      return Guid.TryParse(claim, out var userId) ? userId : null;
    }
  }
}