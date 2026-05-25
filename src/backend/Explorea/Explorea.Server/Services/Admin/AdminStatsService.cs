using Explorea.API.DTOs.Admin.Stats;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminStatsService : IAdminStatsService
    {
        private readonly AppDbContext _db;
        private readonly IUserRepository _userRepository;
        private readonly IOrganizationAssignmentRepository _assignmentRepository;
        private readonly IConfiguration _configuration;
        private readonly IAdminErrorLogService _errorLogService;

        public AdminStatsService(
            AppDbContext db,
            IUserRepository userRepository,
            IOrganizationAssignmentRepository assignmentRepository,
            IConfiguration configuration,
            IAdminErrorLogService errorLogService)
        {
            _db = db;
            _userRepository = userRepository;
            _assignmentRepository = assignmentRepository;
            _configuration = configuration;
            _errorLogService = errorLogService;
        }

        public async Task<AdminStatsOverviewDto> GetOverviewAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var now = DateTimeOffset.UtcNow;
            var recentCutoff = now.AddDays(-30);

            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIdsQuery = destinationQuery.Select(d => d.Id);

            var userQuery = BuildUserScope(user);

            var mostPopularDestination = await GetMostPopularDestinationAsync(destinationIdsQuery);
            var mostPopularEntity = await GetMostPopularEntityAsync(destinationIdsQuery);

            return new AdminStatsOverviewDto
            {
                TotalUsers = await userQuery.CountAsync(),
                NewUsersLast30Days = await userQuery.CountAsync(u => u.CreatedAt >= recentCutoff),
                ActiveDestinations = await destinationQuery.CountAsync(d =>
                    d.Visibility == "published" || d.Visibility == "active"),
                MostPopularDestination = mostPopularDestination,
                MostPopularEntity = mostPopularEntity
            };
        }

        public async Task<List<AdminTrafficPointDto>> GetTrafficAsync(Guid currentUserId, int days)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var clampedDays = Math.Clamp(days, 1, 90);
            var today = DateTime.UtcNow.Date;
            var startDate = today.AddDays(-(clampedDays - 1));

            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIdsQuery = destinationQuery.Select(d => d.Id);

            var viewsByDate = await _db.PopularityLogs
                .Where(l =>
                    l.EntityType == "destination" &&
                    l.Source == "click" &&
                    l.CreatedAt >= startDate &&
                    destinationIdsQuery.Contains(l.EntityId))
                .GroupBy(l => l.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Views = g.Count()
                })
                .ToDictionaryAsync(x => x.Date, x => x.Views);

            return Enumerable.Range(0, clampedDays)
                .Select(offset =>
                {
                    var date = startDate.AddDays(offset);
                    return new AdminTrafficPointDto
                    {
                        Date = date.ToString("yyyy-MM-dd"),
                        Views = viewsByDate.GetValueOrDefault(date, 0)
                    };
                })
                .ToList();
        }

        public async Task<List<AdminSystemStatusItemDto>> GetSystemStatusAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIdsQuery = destinationQuery.Select(d => d.Id);

            var pendingDestinations = await destinationQuery.CountAsync(d =>
                d.Visibility == "pending" || d.Visibility == "draft");

            var pendingSubmissions = await _db.SubmissionQueue.CountAsync(q =>
                q.Status == "Pending" && destinationIdsQuery.Contains(q.DestinationId));

            var openTickets = await BuildSupportTicketScope(user, destinationIdsQuery)
                .CountAsync(t =>
                    t.Status == SupportTicketStatuses.Open ||
                    t.Status == SupportTicketStatuses.InProgress);

            var databaseAvailable = await _db.Database.CanConnectAsync();
            var storageConfigured = IsStorageConfigured();
            var lastError = _errorLogService.GetLastError();

            var items = new List<AdminSystemStatusItemDto>
            {
                new()
                {
                    Label = "Baza podataka",
                    Detail = databaseAvailable ? "Dostupna" : "Nedostupna",
                    Level = databaseAvailable ? "ok" : "critical",
                    Percentage = databaseAvailable ? 100 : 0
                },
                new()
                {
                    Label = "Storage",
                    Detail = storageConfigured ? "Konfigurisan" : "Nije konfigurisan",
                    Level = storageConfigured ? "ok" : "warning",
                    Percentage = storageConfigured ? 100 : 0
                },
                new()
                {
                    Label = "Destinacije na cekanju",
                    Detail = $"{pendingDestinations + pendingSubmissions} zahteva",
                    Level = pendingDestinations + pendingSubmissions > 0 ? "warning" : "ok",
                    Percentage = Math.Min(100, (pendingDestinations + pendingSubmissions) * 10)
                },
                new()
                {
                    Label = "Otvoreni tiketi",
                    Detail = $"{openTickets} aktivnih",
                    Level = openTickets > 10 ? "critical" : openTickets > 0 ? "warning" : "ok",
                    Percentage = Math.Min(100, openTickets * 10)
                }
            };

            items.Add(lastError == null
                ? new AdminSystemStatusItemDto
                {
                    Label = "Poslednja serverska greska",
                    Detail = "Nema zabelezenih 500 gresaka",
                    Level = "ok",
                    Percentage = 0
                }
                : new AdminSystemStatusItemDto
                {
                    Label = "Poslednja serverska greska",
                    Detail = $"{lastError.Method} {lastError.Path} - {lastError.Message}",
                    Level = "critical",
                    Percentage = 100
                });

            return items;
        }

        public async Task<int> GetPendingCountAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name == RoleNames.SuperAdmin || user.Role.Name == RoleNames.TouristOrganization)
            {
                var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
                var destinationIdsQuery = destinationQuery.Select(d => d.Id);
                return await _db.SubmissionQueue.CountAsync(q =>
                    q.Status == "Pending" && destinationIdsQuery.Contains(q.DestinationId));
            }

            // place_owner: count their own pending submissions + pending places they created
            var pendingSubmissions = await _db.SubmissionQueue.CountAsync(q =>
                q.Status == "Pending" && q.SubmittedByUserId == currentUserId);

            var pendingPlaces = await _db.Places
                .IgnoreQueryFilters()
                .CountAsync(p =>
                    !p.IsDeleted &&
                    p.CreatedBy == currentUserId &&
                    p.ApprovalStatus == "pending");

            return pendingSubmissions + pendingPlaces;
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

        private IQueryable<SupportTicket> BuildSupportTicketScope(User user, IQueryable<Guid> destinationIdsQuery)
        {
            var query = _db.SupportTickets.AsQueryable();

            if (user.Role.Name == RoleNames.SuperAdmin)
                return query;

            return query.Where(t =>
                t.AssignedToUserId == user.Id ||
                t.CreatedByAdminId == user.Id ||
                (t.LinkedContextType == SupportLinkedContextTypes.Destination &&
                 t.LinkedContextId.HasValue &&
                 destinationIdsQuery.Contains(t.LinkedContextId.Value)));
        }

        private bool IsStorageConfigured()
        {
            var cloudName = _configuration["Cloudinary:CloudName"];
            var apiKey = _configuration["Cloudinary:ApiKey"];
            var apiSecret = _configuration["Cloudinary:ApiSecret"];

            return !string.IsNullOrWhiteSpace(cloudName) &&
                   !string.IsNullOrWhiteSpace(apiKey) &&
                   !string.IsNullOrWhiteSpace(apiSecret);
        }

        private async Task<AdminPopularEntityDto?> GetMostPopularDestinationAsync(IQueryable<Guid> destinationIdsQuery)
        {
            var top = await _db.PopularityLogs
                .Where(l =>
                    l.EntityType == "destination" &&
                    l.Source == "click" &&
                    destinationIdsQuery.Contains(l.EntityId))
                .GroupBy(l => l.EntityId)
                .Select(g => new { EntityId = g.Key, Views = g.Count() })
                .OrderByDescending(x => x.Views)
                .FirstOrDefaultAsync();

            if (top == null)
                return null;

            var name = await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => d.Id == top.EntityId && !d.IsDeleted)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();

            return string.IsNullOrWhiteSpace(name)
                ? null
                : new AdminPopularEntityDto
                {
                    EntityType = "destination",
                    EntityId = top.EntityId,
                    Name = name,
                    Views = top.Views
                };
        }

        private async Task<AdminPopularEntityDto?> GetMostPopularEntityAsync(IQueryable<Guid> destinationIdsQuery)
        {
            var candidates = await _db.PopularityLogs
                .Where(l =>
                    l.Source == "click" &&
                    (l.EntityType == "destination" ||
                     l.EntityType == "place" ||
                     l.EntityType == "event" ||
                     l.EntityType == "activity"))
                .GroupBy(l => new { l.EntityType, l.EntityId })
                .Select(g => new
                {
                    g.Key.EntityType,
                    g.Key.EntityId,
                    Views = g.Count()
                })
                .OrderByDescending(x => x.Views)
                .Take(20)
                .ToListAsync();

            foreach (var candidate in candidates)
            {
                var entity = await ResolvePopularEntityAsync(
                    candidate.EntityType,
                    candidate.EntityId,
                    candidate.Views,
                    destinationIdsQuery);

                if (entity != null)
                    return entity;
            }

            return null;
        }

        private async Task<AdminPopularEntityDto?> ResolvePopularEntityAsync(
            string entityType,
            Guid entityId,
            int views,
            IQueryable<Guid> destinationIdsQuery)
        {
            string? name = entityType switch
            {
                "destination" => await _db.Destinations
                    .IgnoreQueryFilters()
                    .Where(d => d.Id == entityId && !d.IsDeleted && destinationIdsQuery.Contains(d.Id))
                    .Select(d => d.Name)
                    .FirstOrDefaultAsync(),

                "place" => await _db.Places
                    .IgnoreQueryFilters()
                    .Where(p =>
                        p.Id == entityId &&
                        !p.IsDeleted &&
                        p.DestinationId.HasValue &&
                        destinationIdsQuery.Contains(p.DestinationId.Value))
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync(),

                "event" => await _db.Events
                    .IgnoreQueryFilters()
                    .Where(e =>
                        e.Id == entityId &&
                        !e.IsDeleted &&
                        e.DestinationId.HasValue &&
                        destinationIdsQuery.Contains(e.DestinationId.Value))
                    .Select(e => e.Name)
                    .FirstOrDefaultAsync(),

                "activity" => await _db.Activities
                    .IgnoreQueryFilters()
                    .Where(a =>
                        a.Id == entityId &&
                        !a.IsDeleted &&
                        a.DestinationId.HasValue &&
                        destinationIdsQuery.Contains(a.DestinationId.Value))
                    .Select(a => a.Name)
                    .FirstOrDefaultAsync(),

                _ => null
            };

            return string.IsNullOrWhiteSpace(name)
                ? null
                : new AdminPopularEntityDto
                {
                    EntityType = entityType,
                    EntityId = entityId,
                    Name = name,
                    Views = views
                };
        }
    }
}
