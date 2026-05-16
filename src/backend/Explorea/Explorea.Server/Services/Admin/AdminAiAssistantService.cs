using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Explorea.API.DTOs.Admin.Ai;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminAiAssistantService : IAdminAiAssistantService
    {
        private readonly AppDbContext _db;
        private readonly IUserRepository _userRepository;
        private readonly IOrganizationAssignmentRepository _assignmentRepository;
        private readonly HttpClient _http;
        private readonly IConfiguration _configuration;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public AdminAiAssistantService(
            AppDbContext db,
            IUserRepository userRepository,
            IOrganizationAssignmentRepository assignmentRepository,
            HttpClient http,
            IConfiguration configuration)
        {
            _db = db;
            _userRepository = userRepository;
            _assignmentRepository = assignmentRepository;
            _http = http;
            _configuration = configuration;
        }

        public async Task<AdminAiChatResponseDto> ChatAsync(Guid currentUserId, AdminAiChatRequestDto request)
        {
            var message = request.Message.Trim();
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("Poruka je obavezna.");

            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var context = await BuildContextAsync(user, currentUserId);
            var insights = BuildInsights(context);

            var apiKey = _configuration["AnthropicSettings:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new AdminAiChatResponseDto
                {
                    Message = BuildFallbackAnswer(message, context),
                    Insights = insights
                };
            }

            var response = await AskClaudeAsync(apiKey, request, context);
            return new AdminAiChatResponseDto
            {
                Message = string.IsNullOrWhiteSpace(response) ? BuildFallbackAnswer(message, context) : response,
                Insights = insights
            };
        }

        private async Task<string?> AskClaudeAsync(
            string apiKey,
            AdminAiChatRequestDto request,
            AdminAiContext context)
        {
            var model = _configuration["AnthropicSettings:Model"];
            if (string.IsNullOrWhiteSpace(model))
                model = "claude-sonnet-4-5";

            var messages = new JsonArray();
            foreach (var item in request.History.TakeLast(8))
            {
                var role = item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ||
                           item.Role.Equals("ai", StringComparison.OrdinalIgnoreCase)
                    ? "assistant"
                    : "user";

                if (string.IsNullOrWhiteSpace(item.Content))
                    continue;

                messages.Add(new JsonObject
                {
                    ["role"] = role,
                    ["content"] = item.Content.Trim()
                });
            }

            messages.Add(new JsonObject
            {
                ["role"] = "user",
                ["content"] = request.Message.Trim()
            });

            var body = new JsonObject
            {
                ["model"] = model,
                ["max_tokens"] = 700,
                ["system"] = BuildSystemPrompt(context),
                ["messages"] = messages
            };

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
            {
                Content = JsonContent.Create(body, options: JsonOptions)
            };
            httpRequest.Headers.Add("x-api-key", apiKey);
            httpRequest.Headers.Add("anthropic-version", "2023-06-01");
            httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await _http.SendAsync(httpRequest);
            var raw = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return null;

            var node = JsonNode.Parse(raw);
            var content = node?["content"]?.AsArray();
            if (content == null)
                return null;

            var parts = content
                .Where(part => part?["type"]?.GetValue<string>() == "text")
                .Select(part => part?["text"]?.GetValue<string>())
                .Where(text => !string.IsNullOrWhiteSpace(text));

            return string.Join("\n\n", parts);
        }

        private async Task<AdminAiContext> BuildContextAsync(User user, Guid currentUserId)
        {
            var now = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);
            var destinations = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIds = destinations.Select(d => d.Id);

            var users = BuildUserScope(user);

            var pendingDestinations = await destinations.CountAsync(d =>
                d.Visibility == "pending" || d.Visibility == "draft");

            var pendingSubmissions = await _db.SubmissionQueue.CountAsync(q =>
                q.Status == "Pending" && destinationIds.Contains(q.DestinationId));

            var openTickets = await BuildSupportTicketScope(user, destinationIds)
                .CountAsync(t =>
                    t.Status == SupportTicketStatuses.Open ||
                    t.Status == SupportTicketStatuses.InProgress);

            var totalDestinationViews = await _db.PopularityLogs.CountAsync(l =>
                l.EntityType == "destination" &&
                l.Source == "click" &&
                l.CreatedAt >= monthAgo &&
                destinationIds.Contains(l.EntityId));

            var latestReviews = await _db.Reviews.CountAsync(r =>
                r.CreatedAt >= monthAgo);

            var topDestination = await _db.PopularityLogs
                .Where(l =>
                    l.EntityType == "destination" &&
                    l.Source == "click" &&
                    l.CreatedAt >= monthAgo &&
                    destinationIds.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .FirstOrDefaultAsync();

            var topDestinationName = topDestination == null
                ? null
                : await _db.Destinations
                    .IgnoreQueryFilters()
                    .Where(d => d.Id == topDestination.EntityId)
                    .Select(d => d.Name)
                    .FirstOrDefaultAsync();

            return new AdminAiContext
            {
                Role = user.Role.Name,
                TotalUsers = await users.CountAsync(),
                NewUsersLast30Days = await users.CountAsync(u => u.CreatedAt >= monthAgo),
                ActiveDestinations = await destinations.CountAsync(d =>
                    d.Visibility == "published" || d.Visibility == "active"),
                PendingDestinations = pendingDestinations + pendingSubmissions,
                OpenTickets = openTickets,
                ReviewsLast30Days = latestReviews,
                DestinationViewsLast30Days = totalDestinationViews,
                TopDestination = topDestinationName,
                TopDestinationViews = topDestination?.Views ?? 0
            };
        }

        private async Task<IQueryable<Destination>> BuildDestinationScopeAsync(User user, Guid currentUserId)
        {
            var query = _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => !d.IsDeleted);

            if (user.Role.Name == RoleNames.SuperAdmin)
                return query;

            if (user.ManagedRegionId.HasValue)
            {
                var regionId = user.ManagedRegionId.Value;
                return query.Where(d => d.City != null && d.City.RegionId == regionId);
            }

            var assignments = await _assignmentRepository.GetByUserIdAsync(currentUserId);
            var destinationIds = assignments.Select(a => a.DestinationId).ToList();
            return query.Where(d => destinationIds.Contains(d.Id));
        }

        private IQueryable<User> BuildUserScope(User user)
        {
            var query = _db.Users
                .Include(u => u.Role)
                .Include(u => u.CurrentCity)
                .AsQueryable();

            if (user.Role.Name == RoleNames.SuperAdmin)
                return query;

            if (!user.ManagedRegionId.HasValue)
                return query.Where(u => u.Role.Name != RoleNames.SuperAdmin && u.Role.Name != RoleNames.TouristOrganization);

            var regionId = user.ManagedRegionId.Value;
            return query.Where(u =>
                u.Role.Name != RoleNames.SuperAdmin &&
                u.Role.Name != RoleNames.TouristOrganization &&
                (u.ManagedRegionId == regionId || (u.CurrentCity != null && u.CurrentCity.RegionId == regionId)));
        }

        private IQueryable<SupportTicket> BuildSupportTicketScope(User user, IQueryable<Guid> destinationIds)
        {
            var query = _db.SupportTickets.AsQueryable();
            if (user.Role.Name == RoleNames.SuperAdmin)
                return query;

            return query.Where(t =>
                t.AssignedToUserId == user.Id ||
                t.CreatedByAdminId == user.Id ||
                (t.LinkedContextType == SupportLinkedContextTypes.Destination &&
                 t.LinkedContextId.HasValue &&
                 destinationIds.Contains(t.LinkedContextId.Value)));
        }

        private static string BuildSystemPrompt(AdminAiContext context)
        {
            return
                "Ti si admin AI asistent za Explorea turisticku platformu. " +
                "Odgovaraj kratko, konkretno i na srpskom latinicom. " +
                "Koristi iskljucivo dati admin kontekst; ako podatak ne postoji, reci da nije dostupan. " +
                "Predlazi akcije koje admin moze odmah da uradi.\n\n" +
                $"Admin kontekst: {JsonSerializer.Serialize(context, JsonOptions)}";
        }

        private static string BuildFallbackAnswer(string message, AdminAiContext context)
        {
            if (message.Contains("izvestaj", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("stanje", StringComparison.OrdinalIgnoreCase))
            {
                return
                    $"Kratak izvestaj: trenutno ima {context.TotalUsers} korisnika, " +
                    $"{context.NewUsersLast30Days} novih u poslednjih 30 dana i {context.ActiveDestinations} aktivnih destinacija. " +
                    $"Na cekanju je {context.PendingDestinations} destinacija/zahteva, a otvorenih tiketa je {context.OpenTickets}. " +
                    $"Destinacije su imale {context.DestinationViewsLast30Days} pregleda u poslednjih 30 dana.";
            }

            if (message.Contains("korisnik", StringComparison.OrdinalIgnoreCase))
                return $"Trenutno je u admin opsegu {context.TotalUsers} korisnika, od toga {context.NewUsersLast30Days} novih u poslednjih 30 dana.";

            if (message.Contains("destin", StringComparison.OrdinalIgnoreCase))
            {
                var top = string.IsNullOrWhiteSpace(context.TopDestination)
                    ? "najpopularnija destinacija nije dostupna"
                    : $"najpopularnija destinacija je {context.TopDestination} sa {context.TopDestinationViews} pregleda";

                return $"Aktivnih destinacija ima {context.ActiveDestinations}, na cekanju je {context.PendingDestinations}, a {top} u poslednjih 30 dana.";
            }

            return
                "Claude API kljuc nije konfigurisan, pa prikazujem lokalni odgovor iz baze. " +
                $"Prioriteti: {context.PendingDestinations} destinacija/zahteva ceka obradu, " +
                $"{context.OpenTickets} tiketa je otvoreno, a u poslednjih 30 dana ima {context.NewUsersLast30Days} novih korisnika.";
        }

        private static List<AdminAiInsightDto> BuildInsights(AdminAiContext context)
        {
            var insights = new List<AdminAiInsightDto>();

            if (context.PendingDestinations > 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "warning",
                    Icon = "pending_actions",
                    Text = $"{context.PendingDestinations} destinacija/zahteva ceka odobrenje."
                });
            }

            if (context.OpenTickets > 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = context.OpenTickets > 10 ? "warning" : "neutral",
                    Icon = "support_agent",
                    Text = $"{context.OpenTickets} korisnickih tiketa je trenutno otvoreno."
                });
            }

            if (!string.IsNullOrWhiteSpace(context.TopDestination))
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "positive",
                    Icon = "trending_up",
                    Text = $"Najpopularnija destinacija: {context.TopDestination} ({context.TopDestinationViews} pregleda)."
                });
            }

            if (insights.Count == 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "positive",
                    Icon = "check_circle",
                    Text = "Nema hitnih admin akcija u trenutnom opsegu."
                });
            }

            return insights;
        }

        private class AdminAiContext
        {
            public string Role { get; set; } = string.Empty;
            public int TotalUsers { get; set; }
            public int NewUsersLast30Days { get; set; }
            public int ActiveDestinations { get; set; }
            public int PendingDestinations { get; set; }
            public int OpenTickets { get; set; }
            public int ReviewsLast30Days { get; set; }
            public int DestinationViewsLast30Days { get; set; }
            public string? TopDestination { get; set; }
            public int TopDestinationViews { get; set; }
        }
    }
}
