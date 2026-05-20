using Explorea.API.DTOs.Admin.Settings;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services;
using Explorea.Server.Services.Interfaces;
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

    private readonly ICloudinaryService _cloudinaryService;
    private readonly IAdminNotificationReportService _notificationReportService;

    public AdminSettingsController(
      AppDbContext db,
      ICloudinaryService CloudinaryService,
      IAdminNotificationReportService notificationReportService)
    {
      _db = db;
      _cloudinaryService = CloudinaryService;
      _notificationReportService = notificationReportService;
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
      user.Bio = string.IsNullOrWhiteSpace(dto.Bio)
        ? null
        : dto.Bio.Trim();
      user.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(MapProfile(user));
    }

    [HttpPost("profile-photo")]
[Consumes("multipart/form-data")]
public async Task<IActionResult> UploadProfilePhoto([FromForm] AdminProfilePhotoUploadDto dto)
    {
        var userId = TryGetCurrentUserId();
        if (userId == null) return Unauthorized();

        var file = dto.File;

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Profile photo is required." });

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only image files are allowed." });

        const long maxFileSize = 5 * 1024 * 1024;

        if (file.Length > maxFileSize)
            return BadRequest(new { message = "Profile photo must be smaller than 5MB." });

        var user = await _db.Users
            .Include(u => u.Role)
            .Include(u => u.ManagedRegion)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound(new { message = "User not found." });

        string imageUrl;

        try
        {
            imageUrl = await _cloudinaryService.UploadImageAsync(file, "admin-profile-photos");
        }
        catch (InvalidOperationException)
        {
            return StatusCode(500, new { message = "Profile photo upload is not configured." });
        }
        catch (Exception)
        {
            return StatusCode(500, new { message = "Profile photo upload failed." });
        }

        user.ProfileImageUrl = imageUrl;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(MapProfile(user));
    }
    
    [HttpDelete("profile-photo")]
    public async Task<IActionResult> DeleteProfilePhoto()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var user = await _db.Users
        .Include(u => u.Role)
        .Include(u => u.ManagedRegion)
        .FirstOrDefaultAsync(u => u.Id == userId.Value);

      if(user == null) return NotFound(new {message = "User not found"});

      user.ProfileImageUrl = null;
      user.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(MapProfile(user));
    }
    
    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var role = await GetCurrentUserRole(userId.Value);
      if(role == null) return NotFound(new { message = "User not found." });

      var preferences = await GetOrCreatePreferences(userId.Value);
      var defaultAdminPage = IsAdminPageAllowedForRole(preferences.DefaultAdminPage, role)
        ? preferences.DefaultAdminPage
        : "dashboard";

      return Ok(new AdminAppPreferencesDto
      {
        Theme = preferences.Theme,
        Language = preferences.Language,
        DefaultAdminPage = defaultAdminPage
      });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] AdminUpdateAppPreferencesDto dto)
    {
      if(!ModelState.IsValid) return ValidationProblem(ModelState);

      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var role = await GetCurrentUserRole(userId.Value);
      if(role == null) return NotFound(new { message = "User not found." });

      var preferences = await GetOrCreatePreferences(userId.Value);
      var defaultAdminPage = NormalizeDefaultAdminPage(dto.DefaultAdminPage);

      if(!IsAdminPageAllowedForRole(defaultAdminPage, role))
      {
        return BadRequest(new { message = "Selected admin landing page is not available for this role." });
      }

      preferences.Theme = dto.Theme.Trim();
      preferences.Language = dto.Language.Trim();
      preferences.DefaultAdminPage = defaultAdminPage;
      preferences.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(new AdminAppPreferencesDto
      {
        Theme = preferences.Theme,
        Language = preferences.Language,
        DefaultAdminPage = preferences.DefaultAdminPage
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
        NotificationsEnabled = preferences.NotificationsEnabled,
        EmailNotificationsEnabled = preferences.EmailNotificationsEnabled,
        MarketingEmailsEnabled = preferences.MarketingEmailsEnabled,
        ReportTopics = ParseNotificationReportTopics(preferences.NotificationReportTopics),
        Priority = NormalizeNotificationPriority(preferences.NotificationPriority),
        DeliveryFrequencyDays = NormalizeDeliveryFrequencyDays(preferences.NotificationDeliveryFrequencyDays),
        DeliveryHour = NormalizeDeliveryHour(preferences.NotificationDeliveryHour)
      });
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotifications([FromBody] AdminUpdateNotificationsDto dto)
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var preferences = await GetOrCreatePreferences(userId.Value);

      preferences.NotificationsEnabled = dto.NotificationsEnabled;
      preferences.EmailNotificationsEnabled = dto.EmailNotificationsEnabled;
      preferences.MarketingEmailsEnabled = dto.MarketingEmailsEnabled;
      preferences.NotificationReportTopics = string.Join(",", NormalizeNotificationReportTopics(dto.ReportTopics));
      preferences.NotificationPriority = NormalizeNotificationPriority(dto.Priority);
      preferences.NotificationDeliveryFrequencyDays = NormalizeDeliveryFrequencyDays(dto.DeliveryFrequencyDays);
      preferences.NotificationDeliveryHour = NormalizeDeliveryHour(dto.DeliveryHour);
      preferences.UpdatedAt = DateTimeOffset.UtcNow;

      await _db.SaveChangesAsync();

      return Ok(new AdminNotificationsDto
      {
        NotificationsEnabled = preferences.NotificationsEnabled,
        EmailNotificationsEnabled = preferences.EmailNotificationsEnabled,
        MarketingEmailsEnabled = preferences.MarketingEmailsEnabled,
        ReportTopics = ParseNotificationReportTopics(preferences.NotificationReportTopics),
        Priority = preferences.NotificationPriority,
        DeliveryFrequencyDays = preferences.NotificationDeliveryFrequencyDays,
        DeliveryHour = preferences.NotificationDeliveryHour
      });
    }

    [HttpPost("notifications/reports/send-due")]
    public async Task<IActionResult> SendDueNotificationReports()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var role = await GetCurrentUserRole(userId.Value);
      if(role != "super_admin" && role != "admin") return Forbid();

      var sentCount = await _notificationReportService.SendDueReportsAsync(DateTimeOffset.UtcNow);

      return Ok(new AdminNotificationReportDispatchDto
      {
        SentCount = sentCount
      });
    }

    [HttpGet("administration")]
    public async Task<IActionResult> GetAdministration()
    {
      var userId = TryGetCurrentUserId();
      if(userId == null) return Unauthorized();

      var currentUser = await _db.Users
        .AsNoTracking()
        .Include(u => u.Role)
        .FirstOrDefaultAsync(u => u.Id == userId.Value);

      if(currentUser == null) return NotFound(new { message = "User not found." });

      var currentRole = NormalizeRole(currentUser.Role.Name);

      if(currentRole != "super_admin" && currentRole != "admin") return Forbid();

      var now = DateTimeOffset.UtcNow;

      var onlineAdminsCount = await _db.RefreshTokens
        .AsNoTracking()
        .Where(token => !token.IsRevoked && token.ExpiresAt > now)
        .Where(token =>
          token.User.IsActive &&
          (
            token.User.Role.Name.ToLower() == "admin" ||
            token.User.Role.Name.ToLower() == "super_admin" ||
            token.User.Role.Name.ToLower() == "tourist_organization" ||
            token.User.Role.Name.ToLower() == "place_owner"
          ))
        .Select(token => token.UserId)
        .Distinct()
        .CountAsync();

      var pendingPlaceRequestsCount = await _db.Places
        .AsNoTracking()
        .CountAsync(place => !place.IsDeleted && place.ApprovalStatus.ToLower() == "pending");

      var response = new AdminAdministrationOverviewDto
      {
        Stats = new List<AdminAdministrationStatDto>
        {
          new()
          {
              Icon = "verified_user",
              Label = "Admini trenutno na mrezi",
              Value = onlineAdminsCount.ToString(),
              Description = "Admin nalozi sa aktivnom sesijom u admin panelu."
          },
          new()
          {
              Icon = "pending_actions",
              Label = "Zahtevi na cekanju",
              Value = pendingPlaceRequestsCount.ToString(),
              Description = "Objekti iz places tabele koji cekaju odobravanje."
          }
        },
        Settings = new List<AdminAdministrationSettingDto>
        {
          new()
          {
              Icon = "manage_accounts",
              Title = "Upravljanje admin ulogama",
              Description = "Superadmin može da kontroliše dozvole, regione i pristup drugim adminima.",
              ActionLabel = "Otvori korisnike"
          },
          new()
          {
              Icon = "rule",
              Title = "Pravila moderacije",
              Description = "Pregled pravila za odobravanje destinacija, mesta, događaja i aktivnosti.",
              ActionLabel = "Pregledaj pravila"
          }
        },
        SystemToggles = new List<AdminSystemToggleDto>
        {
          new()
          {
              Icon = "history",
              Title = "Detaljan audit log",
              Description = "Pamti detaljne administrativne akcije radi bezbednosti i kasnije provere.",
              Enabled = true
          }
        }
      };

      return Ok(response);
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
          DefaultAdminPage = "dashboard",
          NotificationsEnabled = true,
          EmailNotificationsEnabled = true,
          MarketingEmailsEnabled = false,
          NotificationReportTopics = "reviews,events,system",
          NotificationPriority = "all",
          NotificationDeliveryFrequencyDays = 7,
          NotificationDeliveryHour = 9,
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
          MemberSince = ResolveMemberSince(user),
          ProfileImageUrl = user.ProfileImageUrl,
          Bio = user.Bio
      };
    }

    private static string FormatRoleLabel(string role)
    {
      return NormalizeRole(role) switch
      {
          "super_admin" => "Super Admin",
          "tourist_organization" => "Tourist Organization",
          "place_owner" => "Place Owner",
          "admin" => "Admin",
          _ => role
      };
    }

    private static string NormalizeRole(string role)
    {
      return role.Trim().ToLowerInvariant().Replace(" ", "_");
    }

    private static string NormalizeDefaultAdminPage(string value)
    {
      if(string.IsNullOrWhiteSpace(value)) return "dashboard";

      var normalized = value.Trim().ToLowerInvariant();

      return normalized switch
      {
          "dashboard" or
          "map-view" or
          "destinations" or
          "events" or
          "activities" or
          "activity-log" or
          "notifications-broadcast" or
          "reviews" or
          "users" or
          "reports" or
          "support" or
          "settings" => normalized,
          _ => "dashboard"
      };
    }

    private static List<string> ParseNotificationReportTopics(string topics)
    {
      return NormalizeNotificationReportTopics(
        topics.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }

    private static List<string> NormalizeNotificationReportTopics(IEnumerable<string>? topics)
    {
      var normalized = (topics ?? Array.Empty<string>())
        .Select(topic => topic.Trim().ToLowerInvariant())
        .Where(topic => topic is "reviews" or "events" or "system" or "weekly_summary")
        .Distinct()
        .ToList();

      return normalized.Contains("weekly_summary")
        ? new List<string> { "weekly_summary" }
        : normalized;
    }

    private static string NormalizeNotificationPriority(string value)
    {
      if(string.IsNullOrWhiteSpace(value)) return "all";

      return value.Trim().ToLowerInvariant() switch
      {
          "important" => "important",
          "all" => "all",
          _ => "all"
      };
    }

    private static int NormalizeDeliveryFrequencyDays(int value)
    {
      return value switch
      {
          1 or 7 or 14 or 30 => value,
          _ => 7
      };
    }

    private static int NormalizeDeliveryHour(int value)
    {
      return value is >= 0 and <= 23 ? value : 9;
    }

    private async Task<string?> GetCurrentUserRole(Guid userId)
    {
      var role = await _db.Users
        .AsNoTracking()
        .Include(u => u.Role)
        .Where(u => u.Id == userId)
        .Select(u => u.Role.Name)
        .FirstOrDefaultAsync();

      return role == null ? null : NormalizeRole(role);
    }

    private static bool IsAdminPageAllowedForRole(string page, string role)
    {
      return role switch
      {
          "super_admin" => true,
          "tourist_organization" => page is
            "dashboard" or
            "map-view" or
            "destinations" or
            "events" or
            "activities" or
            "notifications-broadcast" or
            "reviews" or
            "reports" or
            "support" or
            "settings",
          "place_owner" => page is
            "dashboard" or
            "reviews" or
            "support" or
            "settings",
          _ => page == "dashboard"
      };
    }

    private static string GetInitials(string firstName, string lastName)
    {
      var firstInitial = string.IsNullOrWhiteSpace(firstName) ? "" : firstName[0].ToString();
      var lastInitial = string.IsNullOrWhiteSpace(lastName) ? "" : lastName[0].ToString();

      var initials = $"{firstInitial}{lastInitial}".ToUpperInvariant();
      return string.IsNullOrWhiteSpace(initials) ? "AD" : initials;
    }

    private static DateTimeOffset ResolveMemberSince(User user)
    {
      if(user.MemberSince.Year > 1) return user.MemberSince;

      if(user.CreatedAt.Year > 1) return user.CreatedAt;

      return DateTimeOffset.UtcNow;
    }

    private Guid? TryGetCurrentUserId()
    {
      var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
      return Guid.TryParse(claim, out var userId) ? userId : null;
    }
  }
}
