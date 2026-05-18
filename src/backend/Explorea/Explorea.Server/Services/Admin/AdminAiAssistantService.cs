using System.Text;
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

        public async Task<List<AdminAiInsightDto>> GetInsightsAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var context = await BuildContextAsync(user, currentUserId);
            return BuildInsights(context);
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

            var apiKey = _configuration["GeminiSettings:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new AdminAiChatResponseDto
                {
                    Message = BuildFallbackAnswer(message, context),
                    Insights = insights
                };
            }

            var response = await AskGeminiAsync(apiKey, request, context);
            return new AdminAiChatResponseDto
            {
                Message = string.IsNullOrWhiteSpace(response) ? BuildFallbackAnswer(message, context) : response,
                Insights = insights
            };
        }

        private async Task<string?> AskGeminiAsync(
            string apiKey,
            AdminAiChatRequestDto request,
            AdminAiContext context)
        {
            var contents = new JsonArray();
            foreach (var item in request.History.TakeLast(8))
            {
                if (string.IsNullOrWhiteSpace(item.Content))
                    continue;

                var role = item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ||
                           item.Role.Equals("ai", StringComparison.OrdinalIgnoreCase)
                    ? "model"
                    : "user";

                contents.Add(new JsonObject
                {
                    ["role"] = role,
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = item.Content.Trim() } }
                });
            }

            contents.Add(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray { new JsonObject { ["text"] = request.Message.Trim() } }
            });

            var body = new JsonObject
            {
                ["system_instruction"] = new JsonObject
                {
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = BuildSystemPrompt(context) } }
                },
                ["contents"] = contents,
                ["generationConfig"] = new JsonObject { ["maxOutputTokens"] = 700 }
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
            var bodyJson = body.ToJsonString();
            using var httpContent = new StringContent(bodyJson, System.Text.Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync(url, httpContent);
            var raw = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return null;

            var node = JsonNode.Parse(raw);
            var text = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }

        private async Task<AdminAiContext> BuildContextAsync(User user, Guid currentUserId)
        {
            var now = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);
            var twoMonthsAgo = now.AddDays(-60);
            var weekAgo = now.AddDays(-7);

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

            var viewsThisMonth = await _db.PopularityLogs.CountAsync(l =>
                l.EntityType == "destination" && l.Source == "click" &&
                l.CreatedAt >= monthAgo && destinationIds.Contains(l.EntityId));

            var viewsPrevMonth = await _db.PopularityLogs.CountAsync(l =>
                l.EntityType == "destination" && l.Source == "click" &&
                l.CreatedAt >= twoMonthsAgo && l.CreatedAt < monthAgo &&
                destinationIds.Contains(l.EntityId));

            var latestReviews = await _db.Reviews.CountAsync(r => r.CreatedAt >= monthAgo);

            // Per-destination view breakdown
            var destViewsRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "destination" && l.Source == "click" &&
                            l.CreatedAt >= monthAgo && destinationIds.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .Take(30)
                .ToListAsync();

            var viewedDestIds = destViewsRaw.Select(x => x.EntityId).ToList();
            var destNameMap = await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => viewedDestIds.Contains(d.Id))
                .Select(d => new { d.Id, d.Name })
                .ToDictionaryAsync(d => d.Id, d => d.Name);

            var destinationViewBreakdown = destViewsRaw
                .Select(x => new DestViewEntry(destNameMap.GetValueOrDefault(x.EntityId, "?"), x.Views))
                .ToList();

            // Top event this week
            var topEventRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "event" && l.Source == "click" && l.CreatedAt >= weekAgo)
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .FirstOrDefaultAsync();

            string? topEventName = null;
            int topEventViews = 0;
            if (topEventRaw != null)
            {
                topEventName = await _db.Events
                    .IgnoreQueryFilters()
                    .Where(e => e.Id == topEventRaw.EntityId && !e.IsDeleted)
                    .Select(e => e.Name)
                    .FirstOrDefaultAsync();
                topEventViews = topEventRaw.Views;
            }

            // Least active activity this month
            var leastActiveActivity = await _db.Activities
                .IgnoreQueryFilters()
                .Where(a => !a.IsDeleted && a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                .Select(a => new
                {
                    a.Name,
                    Views = _db.PopularityLogs.Count(l =>
                        l.EntityType == "activity" && l.Source == "click" &&
                        l.CreatedAt >= monthAgo && l.EntityId == a.Id)
                })
                .OrderBy(x => x.Views)
                .FirstOrDefaultAsync();

            var newUsersThisMonth = await users.CountAsync(u => u.CreatedAt >= monthAgo);
            var newUsersPrevMonth = await users.CountAsync(u => u.CreatedAt >= twoMonthsAgo && u.CreatedAt < monthAgo);

            var activeDestinationsQuery = destinations
                .Where(d => d.Visibility == "published" || d.Visibility == "active");

            var activeDestinationNames = await activeDestinationsQuery
                .Select(d => d.Name).Take(50).ToListAsync();

            var activeDestinationCount = await activeDestinationsQuery.CountAsync();

            // Top destination (for backward compat)
            var topDestEntry = destinationViewBreakdown.FirstOrDefault();

            return new AdminAiContext
            {
                Role = user.Role.Name,
                TotalUsers = await users.CountAsync(),
                NewUsersLast30Days = newUsersThisMonth,
                NewUsersPrevious30Days = newUsersPrevMonth,
                ActiveDestinations = activeDestinationCount,
                ActiveDestinationNames = activeDestinationNames,
                DestinationViewBreakdown = destinationViewBreakdown,
                PendingDestinations = pendingDestinations + pendingSubmissions,
                OpenTickets = openTickets,
                ReviewsLast30Days = latestReviews,
                DestinationViewsLast30Days = viewsThisMonth,
                DestinationViewsPrevious30Days = viewsPrevMonth,
                TopDestination = topDestEntry?.Name,
                TopDestinationViews = topDestEntry?.Views ?? 0,
                TopEventThisWeek = topEventName,
                TopEventThisWeekViews = topEventViews,
                LeastActiveActivity = leastActiveActivity?.Name,
                LeastActiveActivityViews = leastActiveActivity?.Views ?? 0
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
            var userGrowth = context.NewUsersPrevious30Days > 0
                ? $"{(int)Math.Round((context.NewUsersLast30Days - context.NewUsersPrevious30Days) * 100.0 / context.NewUsersPrevious30Days):+#;-#;0}% vs prethodni mesec"
                : "nema podataka za poredjenje";

            var trafficGrowth = context.DestinationViewsPrevious30Days > 0
                ? $"{(int)Math.Round((context.DestinationViewsLast30Days - context.DestinationViewsPrevious30Days) * 100.0 / context.DestinationViewsPrevious30Days):+#;-#;0}% vs prethodni mesec"
                : "nema podataka za poredjenje";

            var destinationList = context.ActiveDestinationNames.Count > 0
                ? string.Join(", ", context.ActiveDestinationNames)
                : "nema aktivnih destinacija";

            var viewBreakdown = context.DestinationViewBreakdown.Count > 0
                ? string.Join("; ", context.DestinationViewBreakdown.Select(x => $"{x.Name}: {x.Views}"))
                : "nema podataka";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("Ti si admin AI asistent za Explorea turisticku platformu za Srbiju.");
            sb.AppendLine("Odgovaraj konkretno i korisno na srpskom latinicom (bez dijakritika: s, c, z, dj).");
            sb.AppendLine("Koristi SAMO podatke iz konteksta ispod. Nikad ne izmisljaj informacije.");
            sb.AppendLine("Uz svaki odgovor predlozi 1-2 konkretne admin akcije ili postavi relevantno pratece pitanje.");
            sb.AppendLine("Primeri pitanja koja admin moze postavljati: koliko pregleda ima konkretna destinacija, koji dogadjaj je najpopularniji, koliko novih korisnika ima, sta treba odobriti, koje aktivnosti su neaktivne, pregled tiketa.");
            sb.AppendLine();
            sb.AppendLine("=== ADMIN KONTEKST ===");
            sb.AppendLine($"Korisnici: ukupno {context.TotalUsers}, novo ovaj mesec: {context.NewUsersLast30Days} ({userGrowth}).");
            sb.AppendLine($"Aktivne destinacije ({context.ActiveDestinations}): {destinationList}.");
            sb.AppendLine($"Pregledi destinacija ovaj mesec: {context.DestinationViewsLast30Days} ({trafficGrowth}).");
            sb.AppendLine($"Pregledi po destinacijama ovaj mesec: {viewBreakdown}.");
            sb.AppendLine($"Na cekanju: {context.PendingDestinations} zahteva/destinacija.");
            sb.AppendLine($"Otvoreni support tiketi: {context.OpenTickets}.");
            sb.AppendLine($"Recenzije ovaj mesec: {context.ReviewsLast30Days}.");
            if (!string.IsNullOrWhiteSpace(context.TopEventThisWeek))
                sb.AppendLine($"Najpopularniji dogadjaj ove nedelje: {context.TopEventThisWeek} ({context.TopEventThisWeekViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.LeastActiveActivity))
                sb.AppendLine($"Najneaktivnija aktivnost ovog meseca: {context.LeastActiveActivity} ({context.LeastActiveActivityViews} pregleda).");

            return sb.ToString();
        }

        private static string BuildFallbackAnswer(string message, AdminAiContext context)
        {
            if (message.Contains("izvestaj", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("stanje", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("pregled", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("status", StringComparison.OrdinalIgnoreCase))
            {
                return
                    $"Kratak pregled: trenutno ima {context.TotalUsers} korisnika " +
                    $"({context.NewUsersLast30Days} novih u poslednjih 30 dana), {context.ActiveDestinations} aktivnih destinacija, " +
                    $"{context.PendingDestinations} zahteva na cekanju i {context.OpenTickets} otvorenih tiketa. " +
                    $"Destinacije su zabeleile {context.DestinationViewsLast30Days} pregleda u poslednjih 30 dana.";
            }

            if (message.Contains("korisnik", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("user", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("registr", StringComparison.OrdinalIgnoreCase))
            {
                return $"U admin opsegu ima {context.TotalUsers} korisnika, od toga {context.NewUsersLast30Days} novih u poslednjih 30 dana.";
            }

            if (message.Contains("destin", StringComparison.OrdinalIgnoreCase))
            {
                var top = string.IsNullOrWhiteSpace(context.TopDestination)
                    ? "najpopularnija destinacija nema dovoljno podataka"
                    : $"najpopularnija je \"{context.TopDestination}\" sa {context.TopDestinationViews} pregleda";

                return $"Aktivnih destinacija ima {context.ActiveDestinations}, na cekanju je {context.PendingDestinations}. U poslednjih 30 dana: {top}.";
            }

            if (message.Contains("tiket", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("support", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("podrsk", StringComparison.OrdinalIgnoreCase))
            {
                return context.OpenTickets == 0
                    ? "Trenutno nema otvorenih support tiketa."
                    : $"Otvorenih support tiketa je {context.OpenTickets}. Preporuka: pregledaj tikete i rasporedi ih na agente.";
            }

            if (message.Contains("cekanj", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("zahtev", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("pending", StringComparison.OrdinalIgnoreCase))
            {
                return context.PendingDestinations == 0
                    ? "Nema zahteva na cekanju."
                    : $"Na cekanju je {context.PendingDestinations} destinacija ili zahteva. Preporuka: odobri ili odbij zahteve u sekciji Destinacije.";
            }

            if (message.Contains("recenzij", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("ocen", StringComparison.OrdinalIgnoreCase))
            {
                return $"U poslednjih 30 dana zabeleeno je {context.ReviewsLast30Days} novih recenzija.";
            }

            if (message.Contains("saobracaj", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("poseta", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("pregled", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("analitik", StringComparison.OrdinalIgnoreCase))
            {
                return $"U poslednjih 30 dana destinacije su imale {context.DestinationViewsLast30Days} pregleda." +
                    (string.IsNullOrWhiteSpace(context.TopDestination)
                        ? ""
                        : $" Najpopularnija: \"{context.TopDestination}\" sa {context.TopDestinationViews} pregleda.");
            }

            var prioriteti = new List<string>();
            if (context.PendingDestinations > 0) prioriteti.Add($"{context.PendingDestinations} zahteva ceka obradu");
            if (context.OpenTickets > 0) prioriteti.Add($"{context.OpenTickets} tiketa je otvoreno");
            if (context.NewUsersLast30Days > 0) prioriteti.Add($"{context.NewUsersLast30Days} novih korisnika u poslednjih 30 dana");

            return prioriteti.Count > 0
                ? $"Trenutni prioriteti: {string.Join(", ", prioriteti)}. Pitaj me o korisnicima, destinacijama, tiketima ili saobracaju za vise detalja."
                : "Sve je u redu — nema hitnih admin akcija. Pitaj me o korisnicima, destinacijama, tiketima ili saobracaju.";
        }

        private static List<AdminAiInsightDto> BuildInsights(AdminAiContext context)
        {
            var insights = new List<AdminAiInsightDto>();

            // User growth vs previous month
            if (context.NewUsersPrevious30Days > 0)
            {
                var growthPct = (int)Math.Round(
                    (context.NewUsersLast30Days - context.NewUsersPrevious30Days) * 100.0 / context.NewUsersPrevious30Days);

                if (growthPct > 0)
                {
                    insights.Add(new AdminAiInsightDto
                    {
                        Type = "positive",
                        Icon = "person_add",
                        Text = $"Novi korisnici porasli za {growthPct}% u odnosu na prethodni mesec ({context.NewUsersLast30Days} vs {context.NewUsersPrevious30Days})."
                    });
                }
                else if (growthPct < -10)
                {
                    insights.Add(new AdminAiInsightDto
                    {
                        Type = "warning",
                        Icon = "person_remove",
                        Text = $"Registracije pale za {Math.Abs(growthPct)}% u odnosu na prethodni mesec ({context.NewUsersLast30Days} vs {context.NewUsersPrevious30Days})."
                    });
                }
            }
            else if (context.NewUsersLast30Days > 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "positive",
                    Icon = "person_add",
                    Text = $"{context.NewUsersLast30Days} novih korisnika u poslednjih 30 dana."
                });
            }

            // Traffic trend vs previous month
            if (context.DestinationViewsPrevious30Days > 0)
            {
                var trafficPct = (int)Math.Round(
                    (context.DestinationViewsLast30Days - context.DestinationViewsPrevious30Days) * 100.0 / context.DestinationViewsPrevious30Days);

                if (trafficPct > 5)
                {
                    insights.Add(new AdminAiInsightDto
                    {
                        Type = "positive",
                        Icon = "trending_up",
                        Text = $"Posete destinacija porasle za {trafficPct}% u odnosu na prethodni mesec."
                    });
                }
                else if (trafficPct < -10)
                {
                    insights.Add(new AdminAiInsightDto
                    {
                        Type = "warning",
                        Icon = "trending_down",
                        Text = $"Posete destinacija pale za {Math.Abs(trafficPct)}% u odnosu na prethodni mesec."
                    });
                }
            }

            // Pending destinations
            if (context.PendingDestinations > 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "warning",
                    Icon = "pending_actions",
                    Text = $"{context.PendingDestinations} destinacija/zahteva ceka odobrenje."
                });
            }

            // Open support tickets
            if (context.OpenTickets > 0)
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = context.OpenTickets > 10 ? "warning" : "neutral",
                    Icon = "support_agent",
                    Text = $"{context.OpenTickets} korisnickih tiketa je otvoreno."
                });
            }

            // Top destination
            if (!string.IsNullOrWhiteSpace(context.TopDestination))
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "positive",
                    Icon = "star",
                    Text = $"Najpopularnija ovaj mesec: {context.TopDestination} ({context.TopDestinationViews} pregleda)."
                });
            }

            // Top event this week
            if (!string.IsNullOrWhiteSpace(context.TopEventThisWeek))
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = "positive",
                    Icon = "event",
                    Text = $"Najpopularniji dogadjaj ove nedelje: {context.TopEventThisWeek} ({context.TopEventThisWeekViews} pregleda)."
                });
            }

            // Least active activity
            if (!string.IsNullOrWhiteSpace(context.LeastActiveActivity))
            {
                insights.Add(new AdminAiInsightDto
                {
                    Type = context.LeastActiveActivityViews == 0 ? "warning" : "neutral",
                    Icon = "directions_walk",
                    Text = context.LeastActiveActivityViews == 0
                        ? $"Aktivnost \"{context.LeastActiveActivity}\" nema pregleda ovog meseca — razmotri promociju ili uklanjanje."
                        : $"Aktivnost sa najmanje poseta: \"{context.LeastActiveActivity}\" ({context.LeastActiveActivityViews} pregleda ovog meseca)."
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

        private record DestViewEntry(string Name, int Views);

        private class AdminAiContext
        {
            public string Role { get; set; } = string.Empty;
            public int TotalUsers { get; set; }
            public int NewUsersLast30Days { get; set; }
            public int NewUsersPrevious30Days { get; set; }
            public int ActiveDestinations { get; set; }
            public List<string> ActiveDestinationNames { get; set; } = new();
            public List<DestViewEntry> DestinationViewBreakdown { get; set; } = new();
            public int PendingDestinations { get; set; }
            public int OpenTickets { get; set; }
            public int ReviewsLast30Days { get; set; }
            public int DestinationViewsLast30Days { get; set; }
            public int DestinationViewsPrevious30Days { get; set; }
            public string? TopDestination { get; set; }
            public int TopDestinationViews { get; set; }
            public string? TopEventThisWeek { get; set; }
            public int TopEventThisWeekViews { get; set; }
            public string? LeastActiveActivity { get; set; }
            public int LeastActiveActivityViews { get; set; }
        }
    }
}
