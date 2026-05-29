using Explorea.Server.Services.Interfaces;
using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly AppDbContext _db;

        public ChatController(IChatService chatService, AppDbContext db)
        {
            _chatService = chatService;
            _db = db;
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "Message is required." });

            var history = request.History ?? new List<ChatMessage>();

            if (IsWeekendEventRecommendationRequest(request.Message))
            {
                var recommendationReply = await BuildWeekendEventRecommendationAsync(request.Context);
                return Ok(new { reply = recommendationReply });
            }

            var reply = await _chatService.ChatAsync(history, request.Message, request.Context);
            return Ok(new { reply });
        }

        [HttpGet("history")]
        [Authorize]
        public async Task<IActionResult> GetHistory()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            var history = await _db.UserChatHistories.FindAsync(userId);
            if (history == null)
                return Ok(new { messages = Array.Empty<ChatMessage>() });

            var messages = JsonSerializer.Deserialize<List<ChatMessage>>(
                history.Messages,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            ) ?? new List<ChatMessage>();

            return Ok(new { messages });
        }

        [HttpPut("history")]
        [Authorize]
        public async Task<IActionResult> SaveHistory([FromBody] SaveHistoryRequest request)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            var json = JsonSerializer.Serialize(
                request.Messages,
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
            );

            var history = await _db.UserChatHistories.FindAsync(userId);
            if (history == null)
            {
                _db.UserChatHistories.Add(new UserChatHistory
                {
                    UserId = userId.Value,
                    Messages = json,
                    UpdatedAt = DateTimeOffset.UtcNow,
                });
            }
            else
            {
                history.Messages = json;
                history.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<Guid?> GetCurrentUserIdAsync()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub")
                ?? User.FindFirstValue("nameid");
            if (Guid.TryParse(idClaim, out var userId))
                return userId;

            var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrWhiteSpace(email)) return null;
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            return user?.Id;
        }

        private async Task<string> BuildWeekendEventRecommendationAsync(ChatContext? context)
        {
            var today = DateTimeOffset.UtcNow.Date;
            var daysUntilSaturday = ((int)DayOfWeek.Saturday - (int)today.DayOfWeek + 7) % 7;
            var saturday = today.AddDays(daysUntilSaturday);
            var weekendStart = new DateTimeOffset(saturday, TimeSpan.Zero);
            var weekendEnd = weekendStart.AddDays(2);

            var events = await _db.Events
                .Include(e => e.Type)
                .Include(e => e.City)
                .Include(e => e.Place)
                .Include(e => e.Destination)
                .Where(e =>
                    !e.IsDeleted &&
                    e.Visibility == "published" &&
                    e.StartDatetime < weekendEnd &&
                    e.EndDatetime >= weekendStart)
                .ToListAsync();

            if (events.Count == 0)
                return "Žao mi je, ovog vikenda nema nijednog događaja.";

            var userId = await GetCurrentUserIdAsync();
            var userInterestScores = new Dictionary<int, int>();

            if (userId.HasValue)
            {
                userInterestScores = await _db.UserInterestScores
                    .Where(score => score.UserId == userId.Value && score.Score > 0)
                    .ToDictionaryAsync(score => score.InterestTagId, score => score.Score);

                var selectedInterestIds = await _db.UserInterestTags
                    .Where(tag => tag.UserId == userId.Value)
                    .Select(tag => tag.InterestTagId)
                    .ToListAsync();

                foreach (var interestId in selectedInterestIds)
                    userInterestScores.TryAdd(interestId, 1);
            }

            var eventIds = events.Select(e => e.Id).ToList();
            var eventInterestLinks = await _db.EventInterestTags
                .Where(link => eventIds.Contains(link.EventId))
                .Select(link => new { link.EventId, link.InterestTagId })
                .ToListAsync();

            var interestScoreByEventId = eventInterestLinks
                .GroupBy(link => link.EventId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(link => userInterestScores.TryGetValue(link.InterestTagId, out var score) ? score : 0)
                );

            var userLat = context?.Lat;
            var userLng = context?.Lng;
            if ((!userLat.HasValue || !userLng.HasValue) && userId.HasValue)
            {
                var storedLocation = await _db.Users
                    .Where(u => u.Id == userId.Value)
                    .Select(u => new { u.CurrentLatitude, u.CurrentLongitude })
                    .FirstOrDefaultAsync();

                userLat = storedLocation?.CurrentLatitude;
                userLng = storedLocation?.CurrentLongitude;
            }

            var hasLocation = userLat.HasValue && userLng.HasValue;
            var rankedEvents = events
                .Select(e =>
                {
                    var eventLat = e.Latitude ?? e.Place?.Latitude ?? e.Destination?.Latitude ?? e.City?.Latitude;
                    var eventLng = e.Longitude ?? e.Place?.Longitude ?? e.Destination?.Longitude ?? e.City?.Longitude;
                    var distanceKm = hasLocation && eventLat.HasValue && eventLng.HasValue
                        ? CalculateDistanceKm(userLat.Value, userLng.Value, eventLat.Value, eventLng.Value)
                        : double.MaxValue;

                    return new WeekendEventRecommendation(
                        e,
                        interestScoreByEventId.GetValueOrDefault(e.Id),
                        distanceKm
                    );
                });

            rankedEvents = hasLocation
                ? rankedEvents
                    .OrderBy(item => item.DistanceKm)
                    .ThenByDescending(item => item.InterestScore)
                    .ThenByDescending(item => item.Event.Popularity)
                    .ThenByDescending(item => item.Event.IsFeatured)
                    .ThenBy(item => item.Event.StartDatetime)
                : rankedEvents
                    .OrderByDescending(item => item.InterestScore)
                    .ThenByDescending(item => item.Event.Popularity)
                    .ThenByDescending(item => item.Event.IsFeatured)
                    .ThenBy(item => item.Event.StartDatetime);

            var culture = CultureInfo.GetCultureInfo("sr-Latn-RS");
            var lines = rankedEvents
                .Take(5)
                .Select((item, index) => FormatWeekendEventLine(item, index + 1, hasLocation, culture));

            return "Evo događaja za ovaj vikend koje bih ti preporučio:\n\n" + string.Join("\n", lines);
        }

        private static string FormatWeekendEventLine(
            WeekendEventRecommendation item,
            int index,
            bool hasLocation,
            CultureInfo culture)
        {
            var e = item.Event;
            var start = e.StartDatetime.ToLocalTime().ToString("ddd, d. MMM HH:mm", culture);
            var location = e.City?.Name ?? e.Place?.Name ?? e.Destination?.Name ?? e.Address ?? "lokacija nije navedena";
            var distance = hasLocation && item.DistanceKm < double.MaxValue
                ? $" · {item.DistanceKm:0.#} km od vas"
                : string.Empty;
            var featured = e.IsFeatured ? " · istaknuto" : string.Empty;

            return $"{index}. [{e.Name}](/events/{e.Slug}) — {start} · {location}{distance} · popularnost {e.Popularity}{featured}";
        }

        private static bool IsWeekendEventRecommendationRequest(string message)
        {
            var normalized = NormalizeSerbianText(message);
            return normalized.Contains("predlozi")
                && normalized.Contains("dogadjaj")
                && normalized.Contains("vikend");
        }

        private static string NormalizeSerbianText(string value)
        {
            return value.Trim().ToLowerInvariant()
                .Replace("đ", "dj")
                .Replace("ð", "dj")
                .Replace("č", "c")
                .Replace("ć", "c")
                .Replace("š", "s")
                .Replace("ž", "z");
        }

        private static double CalculateDistanceKm(double lat1, double lng1, double lat2, double lng2)
        {
            const double earthRadiusKm = 6371;
            var dLat = ToRadians(lat2 - lat1);
            var dLng = ToRadians(lng2 - lng1);
            var a =
                Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return earthRadiusKm * c;
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180;
    }

    internal record WeekendEventRecommendation(Event Event, int InterestScore, double DistanceKm);

    public record ChatContext(double? Lat, double? Lng, string? FirstName);
    public record ChatRequest(List<ChatMessage>? History, string Message, ChatContext? Context);
    public record SaveHistoryRequest(List<ChatMessage> Messages);
}
