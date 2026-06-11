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
                    Insights = insights,
                    QuickActions = BuildQuickActions(message, context)
                };
            }

            var response = await AskGeminiAsync(apiKey, request, context);
            return new AdminAiChatResponseDto
            {
                Message = string.IsNullOrWhiteSpace(response) ? BuildFallbackAnswer(message, context) : response,
                Insights = insights,
                QuickActions = BuildQuickActions(message, context)
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

            string? managedRegionName = null;
            if (user.ManagedRegionId.HasValue)
            {
                managedRegionName = await _db.Regions
                    .Where(r => r.Id == user.ManagedRegionId.Value)
                    .Select(r => r.Name)
                    .FirstOrDefaultAsync();
            }

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

            // ===== Per-entity scope helpers =====
            var placeIdsInScope = _db.Places
                .IgnoreQueryFilters()
                .Where(p => !p.IsDeleted && p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value))
                .Select(p => p.Id);

            var eventIdsInScope = _db.Events
                .IgnoreQueryFilters()
                .Where(e => !e.IsDeleted &&
                    ((e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value))
                     || (e.PlaceId.HasValue && placeIdsInScope.Contains(e.PlaceId.Value))))
                .Select(e => e.Id);

            var activityIdsInScope = _db.Activities
                .IgnoreQueryFilters()
                .Where(a => !a.IsDeleted && a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                .Select(a => a.Id);

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
                .Select(x => new EntityViewEntry(destNameMap.GetValueOrDefault(x.EntityId, "?"), x.Views))
                .ToList();

            // Per-place view breakdown (this month)
            var placeViewsRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "place" && l.Source == "click" &&
                            l.CreatedAt >= monthAgo && placeIdsInScope.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .Take(30)
                .ToListAsync();

            var viewedPlaceIds = placeViewsRaw.Select(x => x.EntityId).ToList();
            var placeNameMap = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => viewedPlaceIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name })
                .ToDictionaryAsync(p => p.Id, p => p.Name);

            var placeViewBreakdown = placeViewsRaw
                .Select(x => new EntityViewEntry(placeNameMap.GetValueOrDefault(x.EntityId, "?"), x.Views))
                .ToList();

            // Per-event view breakdown (this month)
            var eventViewsMonthRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "event" && l.Source == "click" &&
                            l.CreatedAt >= monthAgo && eventIdsInScope.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .Take(30)
                .ToListAsync();

            var viewedEventIds = eventViewsMonthRaw.Select(x => x.EntityId).ToList();
            var eventNameMap = await _db.Events
                .IgnoreQueryFilters()
                .Where(e => viewedEventIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Name })
                .ToDictionaryAsync(e => e.Id, e => e.Name);

            var eventViewBreakdown = eventViewsMonthRaw
                .Select(x => new EntityViewEntry(eventNameMap.GetValueOrDefault(x.EntityId, "?"), x.Views))
                .ToList();

            // Per-activity view breakdown (this month)
            var activityViewsRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "activity" && l.Source == "click" &&
                            l.CreatedAt >= monthAgo && activityIdsInScope.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .Take(30)
                .ToListAsync();

            var viewedActivityIds = activityViewsRaw.Select(x => x.EntityId).ToList();
            var activityNameMap = await _db.Activities
                .IgnoreQueryFilters()
                .Where(a => viewedActivityIds.Contains(a.Id))
                .Select(a => new { a.Id, a.Name })
                .ToDictionaryAsync(a => a.Id, a => a.Name);

            var activityViewBreakdown = activityViewsRaw
                .Select(x => new EntityViewEntry(activityNameMap.GetValueOrDefault(x.EntityId, "?"), x.Views))
                .ToList();

            // Top event this week
            var topEventWeekRaw = await _db.PopularityLogs
                .Where(l => l.EntityType == "event" && l.Source == "click" &&
                            l.CreatedAt >= weekAgo && eventIdsInScope.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .FirstOrDefaultAsync();

            string? topEventWeekName = null;
            int topEventWeekViews = 0;
            if (topEventWeekRaw != null)
            {
                topEventWeekName = await _db.Events
                    .IgnoreQueryFilters()
                    .Where(e => e.Id == topEventWeekRaw.EntityId && !e.IsDeleted)
                    .Select(e => e.Name)
                    .FirstOrDefaultAsync();
                topEventWeekViews = topEventWeekRaw.Views;
            }

            // Least active activity this month — include those with 0 views
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

            // Status counts per entity type within scope
            var activePlaces = await _db.Places.IgnoreQueryFilters()
                .CountAsync(p => !p.IsDeleted && p.ApprovalStatus == "approved" &&
                    p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value));
            var pendingPlaces = await _db.Places.IgnoreQueryFilters()
                .CountAsync(p => !p.IsDeleted && p.ApprovalStatus == "pending" &&
                    p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value));

            var activeEvents = await _db.Events.IgnoreQueryFilters()
                .CountAsync(e => !e.IsDeleted && e.Visibility == "published" &&
                    ((e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)) ||
                     (e.PlaceId.HasValue && placeIdsInScope.Contains(e.PlaceId.Value))));
            var pendingEvents = await _db.Events.IgnoreQueryFilters()
                .CountAsync(e => !e.IsDeleted && e.Visibility == "pending" &&
                    ((e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)) ||
                     (e.PlaceId.HasValue && placeIdsInScope.Contains(e.PlaceId.Value))));

            var activeActivities = await _db.Activities.IgnoreQueryFilters()
                .CountAsync(a => !a.IsDeleted &&
                    a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value));

            // Average ratings within scope (rounded to 2 decimals)
            var avgPlaceRating = await _db.Places.IgnoreQueryFilters()
                .Where(p => !p.IsDeleted && p.AvgRating > 0 &&
                    p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value))
                .AverageAsync(p => (decimal?)p.AvgRating) ?? 0m;

            var avgDestinationRating = await destinations
                .Where(d => d.AvgRating > 0)
                .AverageAsync(d => (decimal?)d.AvgRating) ?? 0m;

            var avgActivityRating = await _db.Activities.IgnoreQueryFilters()
                .Where(a => !a.IsDeleted && a.AvgRating > 0 &&
                    a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                .AverageAsync(a => (decimal?)a.AvgRating) ?? 0m;

            var avgEventRating = await _db.Events.IgnoreQueryFilters()
                .Where(e => !e.IsDeleted && e.AvgRating > 0 &&
                    ((e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)) ||
                     (e.PlaceId.HasValue && placeIdsInScope.Contains(e.PlaceId.Value))))
                .AverageAsync(e => (decimal?)e.AvgRating) ?? 0m;

            // New entity additions this month
            var newPlaces = await _db.Places.IgnoreQueryFilters()
                .CountAsync(p => !p.IsDeleted && p.CreatedAt >= monthAgo &&
                    p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value));
            var newActivities = await _db.Activities.IgnoreQueryFilters()
                .CountAsync(a => !a.IsDeleted && a.CreatedAt >= monthAgo &&
                    a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value));
            var newEvents = await _db.Events.IgnoreQueryFilters()
                .CountAsync(e => !e.IsDeleted && e.CreatedAt >= monthAgo &&
                    ((e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value)) ||
                     (e.PlaceId.HasValue && placeIdsInScope.Contains(e.PlaceId.Value))));

            // Single top entries (first from breakdown)
            var topDestEntry = destinationViewBreakdown.FirstOrDefault();
            var topPlaceEntry = placeViewBreakdown.FirstOrDefault();
            var topEventEntry = eventViewBreakdown.FirstOrDefault();
            var topActivityEntry = activityViewBreakdown.FirstOrDefault();

            return new AdminAiContext
            {
                Role = user.Role.Name,
                ManagedRegionName = managedRegionName,
                TotalUsers = await users.CountAsync(),
                NewUsersLast30Days = newUsersThisMonth,
                NewUsersPrevious30Days = newUsersPrevMonth,
                ActiveDestinations = activeDestinationCount,
                ActiveDestinationNames = activeDestinationNames,
                DestinationViewBreakdown = destinationViewBreakdown,
                PlaceViewBreakdown = placeViewBreakdown,
                EventViewBreakdown = eventViewBreakdown,
                ActivityViewBreakdown = activityViewBreakdown,
                PendingDestinations = pendingDestinations + pendingSubmissions,
                OpenTickets = openTickets,
                ReviewsLast30Days = latestReviews,
                DestinationViewsLast30Days = viewsThisMonth,
                DestinationViewsPrevious30Days = viewsPrevMonth,
                TopDestination = topDestEntry?.Name,
                TopDestinationViews = topDestEntry?.Views ?? 0,
                TopEventThisWeek = topEventWeekName,
                TopEventThisWeekViews = topEventWeekViews,
                TopEventThisMonth = topEventEntry?.Name,
                TopEventThisMonthViews = topEventEntry?.Views ?? 0,
                TopPlaceThisMonth = topPlaceEntry?.Name,
                TopPlaceThisMonthViews = topPlaceEntry?.Views ?? 0,
                TopActivityThisMonth = topActivityEntry?.Name,
                TopActivityThisMonthViews = topActivityEntry?.Views ?? 0,
                LeastActiveActivity = leastActiveActivity?.Name,
                LeastActiveActivityViews = leastActiveActivity?.Views ?? 0,
                ActivePlaces = activePlaces,
                PendingPlaces = pendingPlaces,
                ActiveEvents = activeEvents,
                PendingEvents = pendingEvents,
                ActiveActivities = activeActivities,
                AvgDestinationRating = Math.Round(avgDestinationRating, 2),
                AvgPlaceRating = Math.Round(avgPlaceRating, 2),
                AvgEventRating = Math.Round(avgEventRating, 2),
                AvgActivityRating = Math.Round(avgActivityRating, 2),
                NewPlacesLast30Days = newPlaces,
                NewActivitiesLast30Days = newActivities,
                NewEventsLast30Days = newEvents
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
            var isTO = context.Role == RoleNames.TouristOrganization;
            var scopeLabel = isTO
                ? $"turisticka organizacija za regiju {context.ManagedRegionName ?? "(nepoznata)"}"
                : "super admin (sva regija u Srbiji)";

            var trafficGrowth = context.DestinationViewsPrevious30Days > 0
                ? $"{(int)Math.Round((context.DestinationViewsLast30Days - context.DestinationViewsPrevious30Days) * 100.0 / context.DestinationViewsPrevious30Days):+#;-#;0}% vs prethodni mesec"
                : "nema podataka za poredjenje";

            var destinationList = context.ActiveDestinationNames.Count > 0
                ? string.Join(", ", context.ActiveDestinationNames)
                : "nema aktivnih destinacija";

            string Breakdown(List<EntityViewEntry> entries) =>
                entries.Count > 0 ? string.Join("; ", entries.Select(x => $"{x.Name}: {x.Views}")) : "nema podataka";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("Ti si admin AI asistent za Explorea turisticku platformu za Srbiju.");
            sb.AppendLine($"Korisnik koji ti postavlja pitanja je: {scopeLabel}.");
            sb.AppendLine("Odgovaraj konkretno i korisno na srpskom latinicom (bez dijakritika: s, c, z, dj).");
            sb.AppendLine("Koristi SAMO podatke iz konteksta ispod. Nikad ne izmisljaj informacije.");
            sb.AppendLine("Sve liste u kontekstu su vec sortirane po broju pregleda (top na pocetku). Kada korisnik trazi listu, koristi tacno te podatke.");
            sb.AppendLine("Uz svaki odgovor predlozi 1-2 konkretne admin akcije ili postavi relevantno pratece pitanje.");
            sb.AppendLine("Ako bi korisniku pomogla navigacija, spomeni koju admin sekciju da otvori; aplikacija ce prikazati dugmad za podrzane quick actions.");
            sb.AppendLine("Primeri pitanja: koja je najpopularnija destinacija/mesto/aktivnost/dogadjaj ovog meseca, lista entiteta po broju pregleda, prosecne ocene, broj novih dodataka, sta ceka odobravanje, pregled tiketa.");
            sb.AppendLine("FORMATIRANJE: Nikad ne koristis markdown. Bez zvezdica (*), bez boldovanja (**rec**), bez bullet lista sa crticom ili zvezdicom. Pisi kao obican tekst, prirodnim recima.");
            sb.AppendLine("OGRANICENJA: Ti si asistent za analizu i informacije — ne mozes da dodajes, menjas ni brises podatke u sistemu. Ako te pitaju da dodas destinaciju, dogadjaj ili slicno, odgovori prirodno i kratko da to mozes samo da ti pokaze gde to moze da uradi sam, a zatim ponudi korisne informacije iz konteksta. Ne izvinjuj se previse — samo preusmeri razgovor.");

            if (isTO)
            {
                sb.AppendLine("VAZNO: Kao turisticka organizacija nemas pristup podacima o korisnicima platforme. Ako te pitaju o registrovanim korisnicima, broju korisnika, novim registracijama ili profilima korisnika, kratko reci da te informacije nisu u tvom opsegu i preusmeri razgovor na destinacije, mesta, aktivnosti, dogadjaje, tikete ili recenzije iz tvoje regije.");
                sb.AppendLine("Svi statisticki podaci ispod su iskljucivo iz tvoje regije.");
            }

            sb.AppendLine();
            sb.AppendLine("=== ADMIN KONTEKST ===");
            if (!isTO)
            {
                var userGrowth = context.NewUsersPrevious30Days > 0
                    ? $"{(int)Math.Round((context.NewUsersLast30Days - context.NewUsersPrevious30Days) * 100.0 / context.NewUsersPrevious30Days):+#;-#;0}% vs prethodni mesec"
                    : "nema podataka za poredjenje";
                sb.AppendLine($"Korisnici: ukupno {context.TotalUsers}, novo u poslednjih 30 dana: {context.NewUsersLast30Days} ({userGrowth}).");
            }
            sb.AppendLine($"Aktivne destinacije ({context.ActiveDestinations}): {destinationList}.");
            sb.AppendLine($"Aktivna mesta: {context.ActivePlaces}, na cekanju: {context.PendingPlaces}.");
            sb.AppendLine($"Aktivni dogadjaji: {context.ActiveEvents}, na cekanju: {context.PendingEvents}.");
            sb.AppendLine($"Aktivne aktivnosti: {context.ActiveActivities}.");
            sb.AppendLine($"Novi dodaci u poslednjih 30 dana — mesta: {context.NewPlacesLast30Days}, aktivnosti: {context.NewActivitiesLast30Days}, dogadjaji: {context.NewEventsLast30Days}.");
            sb.AppendLine($"Prosecne ocene — destinacije: {context.AvgDestinationRating}, mesta: {context.AvgPlaceRating}, aktivnosti: {context.AvgActivityRating}, dogadjaji: {context.AvgEventRating}.");
            sb.AppendLine($"Pregledi destinacija u poslednjih 30 dana: {context.DestinationViewsLast30Days} ({trafficGrowth}).");
            sb.AppendLine($"Pregledi po destinacijama ovaj mesec (sortirano): {Breakdown(context.DestinationViewBreakdown)}.");
            sb.AppendLine($"Pregledi po mestima ovaj mesec (sortirano): {Breakdown(context.PlaceViewBreakdown)}.");
            sb.AppendLine($"Pregledi po aktivnostima ovaj mesec (sortirano): {Breakdown(context.ActivityViewBreakdown)}.");
            sb.AppendLine($"Pregledi po dogadjajima ovaj mesec (sortirano): {Breakdown(context.EventViewBreakdown)}.");
            sb.AppendLine($"Na cekanju (destinacije + submission queue): {context.PendingDestinations}.");
            sb.AppendLine($"Otvoreni support tiketi: {context.OpenTickets}.");
            sb.AppendLine($"Recenzije u poslednjih 30 dana: {context.ReviewsLast30Days}.");
            if (!string.IsNullOrWhiteSpace(context.TopDestination))
                sb.AppendLine($"Najpopularnija destinacija ovog meseca: {context.TopDestination} ({context.TopDestinationViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.TopPlaceThisMonth))
                sb.AppendLine($"Najpopularnije mesto ovog meseca: {context.TopPlaceThisMonth} ({context.TopPlaceThisMonthViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.TopActivityThisMonth))
                sb.AppendLine($"Najpopularnija aktivnost ovog meseca: {context.TopActivityThisMonth} ({context.TopActivityThisMonthViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.TopEventThisMonth))
                sb.AppendLine($"Najpopularniji dogadjaj ovog meseca: {context.TopEventThisMonth} ({context.TopEventThisMonthViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.TopEventThisWeek))
                sb.AppendLine($"Najpopularniji dogadjaj ove nedelje: {context.TopEventThisWeek} ({context.TopEventThisWeekViews} pregleda).");
            if (!string.IsNullOrWhiteSpace(context.LeastActiveActivity))
                sb.AppendLine($"Najneaktivnija aktivnost ovog meseca: {context.LeastActiveActivity} ({context.LeastActiveActivityViews} pregleda).");

            return sb.ToString();
        }

        private static string BuildFallbackAnswer(string message, AdminAiContext context)
        {
            var isTO = context.Role == RoleNames.TouristOrganization;
            var lower = message.ToLowerInvariant();

            // TO has no access to user data
            if (isTO && (lower.Contains("korisnik") || lower.Contains("user") || lower.Contains("registr")))
            {
                return "Podaci o korisnicima nisu u tvom opsegu. Mogu da ti pomognem oko destinacija, mesta, aktivnosti, dogadjaja, recenzija ili tiketa u tvojoj regiji.";
            }

            string FormatList(List<EntityViewEntry> entries, int take = 10)
            {
                if (entries.Count == 0) return "nema podataka";
                return string.Join(", ", entries.Take(take).Select((x, i) => $"{i + 1}. {x.Name} ({x.Views})"));
            }

            // "lista X po pregledima"
            if (lower.Contains("lista") || lower.Contains("svih") || lower.Contains("rangir") || lower.Contains("top"))
            {
                if (lower.Contains("aktivnost"))
                    return $"Aktivnosti po broju pregleda ovog meseca: {FormatList(context.ActivityViewBreakdown)}.";
                if (lower.Contains("mest") || lower.Contains("objek") || lower.Contains("place"))
                    return $"Mesta po broju pregleda ovog meseca: {FormatList(context.PlaceViewBreakdown)}.";
                if (lower.Contains("dogadj") || lower.Contains("event"))
                    return $"Dogadjaji po broju pregleda ovog meseca: {FormatList(context.EventViewBreakdown)}.";
                if (lower.Contains("destin"))
                    return $"Destinacije po broju pregleda ovog meseca: {FormatList(context.DestinationViewBreakdown)}.";
            }

            // Most popular — per entity type
            if (lower.Contains("najpopular") || lower.Contains("najposecen") || lower.Contains("najvise pregleda"))
            {
                if (lower.Contains("aktivnost"))
                    return string.IsNullOrWhiteSpace(context.TopActivityThisMonth)
                        ? "Nema dovoljno podataka o pregledima aktivnosti ovog meseca."
                        : $"Najpopularnija aktivnost ovog meseca je \"{context.TopActivityThisMonth}\" sa {context.TopActivityThisMonthViews} pregleda.";
                if (lower.Contains("mest") || lower.Contains("objek") || lower.Contains("place"))
                    return string.IsNullOrWhiteSpace(context.TopPlaceThisMonth)
                        ? "Nema dovoljno podataka o pregledima mesta ovog meseca."
                        : $"Najpopularnije mesto ovog meseca je \"{context.TopPlaceThisMonth}\" sa {context.TopPlaceThisMonthViews} pregleda.";
                if (lower.Contains("dogadj") || lower.Contains("event"))
                    return string.IsNullOrWhiteSpace(context.TopEventThisMonth)
                        ? "Nema dovoljno podataka o pregledima dogadjaja ovog meseca."
                        : $"Najpopularniji dogadjaj ovog meseca je \"{context.TopEventThisMonth}\" sa {context.TopEventThisMonthViews} pregleda.";
                if (lower.Contains("destin"))
                    return string.IsNullOrWhiteSpace(context.TopDestination)
                        ? "Nema dovoljno podataka o pregledima destinacija ovog meseca."
                        : $"Najpopularnija destinacija ovog meseca je \"{context.TopDestination}\" sa {context.TopDestinationViews} pregleda.";
            }

            // Average ratings
            if (lower.Contains("prosec") || lower.Contains("ocen") || lower.Contains("rating"))
            {
                return $"Prosecne ocene u opsegu — destinacije: {context.AvgDestinationRating}, mesta: {context.AvgPlaceRating}, aktivnosti: {context.AvgActivityRating}, dogadjaji: {context.AvgEventRating}.";
            }

            // New additions
            if (lower.Contains("novi") || lower.Contains("dodato") || lower.Contains("kreirano"))
            {
                return $"U poslednjih 30 dana dodato je: {context.NewPlacesLast30Days} mesta, {context.NewActivitiesLast30Days} aktivnosti i {context.NewEventsLast30Days} dogadjaja.";
            }

            if (lower.Contains("izvestaj") || lower.Contains("stanje") || lower.Contains("pregled") || lower.Contains("status"))
            {
                var userPart = isTO
                    ? ""
                    : $"trenutno ima {context.TotalUsers} korisnika ({context.NewUsersLast30Days} novih u poslednjih 30 dana), ";
                return
                    $"Kratak pregled: {userPart}{context.ActiveDestinations} aktivnih destinacija, " +
                    $"{context.ActivePlaces} mesta i {context.ActiveActivities} aktivnosti, " +
                    $"{context.PendingDestinations} zahteva na cekanju i {context.OpenTickets} otvorenih tiketa. " +
                    $"Destinacije su zabelezile {context.DestinationViewsLast30Days} pregleda u poslednjih 30 dana.";
            }

            if (!isTO && (lower.Contains("korisnik") || lower.Contains("user") || lower.Contains("registr")))
            {
                return $"U admin opsegu ima {context.TotalUsers} korisnika, od toga {context.NewUsersLast30Days} novih u poslednjih 30 dana.";
            }

            if (lower.Contains("destin"))
            {
                var top = string.IsNullOrWhiteSpace(context.TopDestination)
                    ? "najpopularnija destinacija nema dovoljno podataka"
                    : $"najpopularnija je \"{context.TopDestination}\" sa {context.TopDestinationViews} pregleda";
                return $"Aktivnih destinacija ima {context.ActiveDestinations}, na cekanju je {context.PendingDestinations}. U poslednjih 30 dana: {top}.";
            }

            if (lower.Contains("aktivnost"))
            {
                var top = string.IsNullOrWhiteSpace(context.TopActivityThisMonth)
                    ? "nema dovoljno podataka o pregledima"
                    : $"najpopularnija je \"{context.TopActivityThisMonth}\" sa {context.TopActivityThisMonthViews} pregleda";
                return $"U opsegu ima {context.ActiveActivities} aktivnosti. Ovog meseca {top}.";
            }

            if (lower.Contains("mest") || lower.Contains("objek") || lower.Contains("place"))
            {
                var top = string.IsNullOrWhiteSpace(context.TopPlaceThisMonth)
                    ? "nema dovoljno podataka o pregledima"
                    : $"najpopularnije je \"{context.TopPlaceThisMonth}\" sa {context.TopPlaceThisMonthViews} pregleda";
                return $"Aktivnih mesta: {context.ActivePlaces}, na cekanju: {context.PendingPlaces}. Ovog meseca {top}.";
            }

            if (lower.Contains("dogadj") || lower.Contains("event"))
            {
                var top = string.IsNullOrWhiteSpace(context.TopEventThisMonth)
                    ? "nema dovoljno podataka o pregledima"
                    : $"najpopularniji je \"{context.TopEventThisMonth}\" sa {context.TopEventThisMonthViews} pregleda";
                return $"Aktivnih dogadjaja: {context.ActiveEvents}, na cekanju: {context.PendingEvents}. Ovog meseca {top}.";
            }

            if (lower.Contains("tiket") || lower.Contains("support") || lower.Contains("podrsk"))
            {
                return context.OpenTickets == 0
                    ? "Trenutno nema otvorenih support tiketa."
                    : $"Otvorenih support tiketa je {context.OpenTickets}. Preporuka: pregledaj tikete i rasporedi ih na agente.";
            }

            if (lower.Contains("cekanj") || lower.Contains("zahtev") || lower.Contains("pending") || lower.Contains("odobri"))
            {
                var parts = new List<string>();
                if (context.PendingDestinations > 0) parts.Add($"{context.PendingDestinations} destinacija/zahteva");
                if (context.PendingPlaces > 0) parts.Add($"{context.PendingPlaces} mesta");
                if (context.PendingEvents > 0) parts.Add($"{context.PendingEvents} dogadjaja");
                return parts.Count == 0
                    ? "Nema zahteva na cekanju."
                    : $"Na cekanju je: {string.Join(", ", parts)}. Preporuka: obradi u odgovarajucoj admin sekciji.";
            }

            if (lower.Contains("recenz"))
            {
                return $"U poslednjih 30 dana zabelezeno je {context.ReviewsLast30Days} novih recenzija. Prosecne ocene — destinacije: {context.AvgDestinationRating}, mesta: {context.AvgPlaceRating}, aktivnosti: {context.AvgActivityRating}, dogadjaji: {context.AvgEventRating}.";
            }

            if (lower.Contains("saobracaj") || lower.Contains("poseta") || lower.Contains("analitik"))
            {
                return $"U poslednjih 30 dana destinacije su imale {context.DestinationViewsLast30Days} pregleda." +
                    (string.IsNullOrWhiteSpace(context.TopDestination)
                        ? ""
                        : $" Najpopularnija: \"{context.TopDestination}\" sa {context.TopDestinationViews} pregleda.");
            }

            var prioriteti = new List<string>();
            if (context.PendingDestinations > 0) prioriteti.Add($"{context.PendingDestinations} zahteva ceka obradu");
            if (context.OpenTickets > 0) prioriteti.Add($"{context.OpenTickets} tiketa je otvoreno");
            if (!isTO && context.NewUsersLast30Days > 0) prioriteti.Add($"{context.NewUsersLast30Days} novih korisnika u poslednjih 30 dana");

            var hint = isTO
                ? "Pitaj me o destinacijama, mestima, aktivnostima, dogadjajima, recenzijama ili tiketima u tvojoj regiji."
                : "Pitaj me o korisnicima, destinacijama, mestima, aktivnostima, dogadjajima, tiketima ili saobracaju.";

            return prioriteti.Count > 0
                ? $"Trenutni prioriteti: {string.Join(", ", prioriteti)}. {hint}"
                : $"Sve je u redu — nema hitnih admin akcija. {hint}";
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

        private static List<AdminAiQuickActionDto> BuildQuickActions(string message, AdminAiContext context)
        {
            var normalized = message.Trim().ToLowerInvariant();
            var actions = new List<AdminAiQuickActionDto>();

            void Add(string id, string icon, string label, string route)
            {
                if (actions.Any(a => a.Id == id)) return;
                actions.Add(new AdminAiQuickActionDto
                {
                    Id = id,
                    Icon = icon,
                    Label = label,
                    Route = route
                });
            }

            if (ContainsAny(normalized, "tiket", "support", "podrsk", "eskal"))
                Add("open-support", "support_agent", "Otvori support", "/admin/support");

            if (ContainsAny(normalized, "korisnik", "user", "registr"))
                Add("open-users", "people", "Otvori korisnike", "/admin/users");

            if (ContainsAny(normalized, "destin", "zahtev", "odobri", "cekanj", "pending"))
                Add("open-destinations", "landscape", "Otvori destinacije", "/admin/destinations");

            if (ContainsAny(normalized, "dogadj", "event"))
                Add("open-events", "event", "Otvori dogadjaje", "/admin/events");

            if (ContainsAny(normalized, "aktivnost", "activity", "neaktiv"))
                Add("open-activities", "directions_walk", "Otvori aktivnosti", "/admin/activities");

            if (ContainsAny(normalized, "mesto", "objek", "place"))
                Add("open-places", "storefront", "Otvori mesta", "/admin/places");

            if (ContainsAny(normalized, "recenz", "ocen"))
                Add("open-reviews", "rate_review", "Otvori recenzije", "/admin/reviews");

            if (ContainsAny(normalized, "izvestaj", "report", "analitik", "saobracaj", "pregled", "stat"))
                Add("open-reports", "assessment", "Otvori izvestaje", "/admin/reports");

            if (ContainsAny(normalized, "obavest", "broadcast", "notifik"))
                Add("open-broadcast", "campaign", "Posalji obavestenje", "/admin/notifications/broadcast");

            if (actions.Count == 0)
            {
                if (context.PendingDestinations > 0)
                    Add("open-destinations", "landscape", "Pregledaj zahteve", "/admin/destinations");
                if (context.OpenTickets > 0)
                    Add("open-support", "support_agent", "Pregledaj tikete", "/admin/support");
                if (actions.Count == 0)
                    Add("open-dashboard", "dashboard", "Ostani na dashboardu", "/admin/dashboard");
            }

            return actions.Take(3).ToList();
        }

        private static bool ContainsAny(string value, params string[] terms)
        {
            return terms.Any(value.Contains);
        }

        private record EntityViewEntry(string Name, int Views);

        private class AdminAiContext
        {
            public string Role { get; set; } = string.Empty;
            public string? ManagedRegionName { get; set; }
            public int TotalUsers { get; set; }
            public int NewUsersLast30Days { get; set; }
            public int NewUsersPrevious30Days { get; set; }
            public int ActiveDestinations { get; set; }
            public List<string> ActiveDestinationNames { get; set; } = new();
            public List<EntityViewEntry> DestinationViewBreakdown { get; set; } = new();
            public List<EntityViewEntry> PlaceViewBreakdown { get; set; } = new();
            public List<EntityViewEntry> EventViewBreakdown { get; set; } = new();
            public List<EntityViewEntry> ActivityViewBreakdown { get; set; } = new();
            public int PendingDestinations { get; set; }
            public int OpenTickets { get; set; }
            public int ReviewsLast30Days { get; set; }
            public int DestinationViewsLast30Days { get; set; }
            public int DestinationViewsPrevious30Days { get; set; }
            public string? TopDestination { get; set; }
            public int TopDestinationViews { get; set; }
            public string? TopEventThisWeek { get; set; }
            public int TopEventThisWeekViews { get; set; }
            public string? TopEventThisMonth { get; set; }
            public int TopEventThisMonthViews { get; set; }
            public string? TopPlaceThisMonth { get; set; }
            public int TopPlaceThisMonthViews { get; set; }
            public string? TopActivityThisMonth { get; set; }
            public int TopActivityThisMonthViews { get; set; }
            public string? LeastActiveActivity { get; set; }
            public int LeastActiveActivityViews { get; set; }
            public int ActivePlaces { get; set; }
            public int PendingPlaces { get; set; }
            public int ActiveEvents { get; set; }
            public int PendingEvents { get; set; }
            public int ActiveActivities { get; set; }
            public decimal AvgDestinationRating { get; set; }
            public decimal AvgPlaceRating { get; set; }
            public decimal AvgEventRating { get; set; }
            public decimal AvgActivityRating { get; set; }
            public int NewPlacesLast30Days { get; set; }
            public int NewActivitiesLast30Days { get; set; }
            public int NewEventsLast30Days { get; set; }
        }
    }
}
