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

            if (user.Role.Name != RoleNames.SuperAdmin &&
                user.Role.Name != RoleNames.TouristOrganization &&
                user.Role.Name != RoleNames.PlaceOwner)
                throw new UnauthorizedAccessException("Access denied.");

            var now = DateTimeOffset.UtcNow;
            var recentCutoff = now.AddDays(-30);

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                var placeQuery = BuildOwnerPlaceScope(currentUserId);
                var eventQuery = BuildOwnerEventScope(currentUserId);

                var totalPlaces = await placeQuery.CountAsync();
                var totalEvents = await eventQuery.CountAsync();
                var activePlaces = await placeQuery.CountAsync(p => p.ApprovalStatus == "approved");
                var activeEvents = await eventQuery.CountAsync(e =>
                    e.Visibility == "published" || e.Visibility == "active");
                var mostPopularOwnerEntity = await GetMostPopularOwnerEntityAsync(currentUserId);

                return new AdminStatsOverviewDto
                {
                    TotalUsers = totalPlaces + totalEvents,
                    NewUsersLast30Days =
                        await placeQuery.CountAsync(p => p.CreatedAt >= recentCutoff) +
                        await eventQuery.CountAsync(e => e.CreatedAt >= recentCutoff),
                    ActiveDestinations = activePlaces + activeEvents,
                    MostPopularDestination = await GetMostPopularOwnerDestinationAsync(currentUserId),
                    MostPopularEntity = mostPopularOwnerEntity
                };
            }

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

            if (user.Role.Name != RoleNames.SuperAdmin &&
                user.Role.Name != RoleNames.TouristOrganization &&
                user.Role.Name != RoleNames.PlaceOwner)
                throw new UnauthorizedAccessException("Access denied.");

            var clampedDays = Math.Clamp(days, 1, 90);
            var today = DateTime.UtcNow.Date;
            var startDate = today.AddDays(-(clampedDays - 1));

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                var ownerPlaceIdsQuery = BuildOwnerPlaceScope(currentUserId).Select(p => p.Id);
                var ownerEventIdsQuery = BuildOwnerEventScope(currentUserId).Select(e => e.Id);

                var ownerViewsByDate = await _db.PopularityLogs
                    .Where(l =>
                        l.Source == "click" &&
                        l.CreatedAt >= startDate &&
                        ((l.EntityType == "place" && ownerPlaceIdsQuery.Contains(l.EntityId)) ||
                         (l.EntityType == "event" && ownerEventIdsQuery.Contains(l.EntityId))))
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
                            Views = ownerViewsByDate.GetValueOrDefault(date, 0)
                        };
                    })
                    .ToList();
            }

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

            var pending = pendingDestinations + pendingSubmissions;
            var items = new List<AdminSystemStatusItemDto>
            {
                new()
                {
                    Label = "system.db",
                    Detail = databaseAvailable ? "system.db.ok" : "system.db.error",
                    Level = databaseAvailable ? "ok" : "critical",
                    Percentage = databaseAvailable ? 100 : 0
                },
                new()
                {
                    Label = "system.storage",
                    Detail = storageConfigured ? "system.storage.ok" : "system.storage.error",
                    Level = storageConfigured ? "ok" : "warning",
                    Percentage = storageConfigured ? 100 : 0
                },
                new()
                {
                    Label = "system.pending_dest",
                    Detail = $"{pending}",
                    DetailKey = "system.pending_dest.detail",
                    Level = pending > 0 ? "warning" : "ok",
                    Percentage = Math.Min(100, pending * 10)
                },
                new()
                {
                    Label = "system.open_tickets",
                    Detail = $"{openTickets}",
                    DetailKey = "system.open_tickets.detail",
                    Level = openTickets > 10 ? "critical" : openTickets > 0 ? "warning" : "ok",
                    Percentage = Math.Min(100, openTickets * 10)
                }
            };

            items.Add(lastError == null
                ? new AdminSystemStatusItemDto
                {
                    Label = "system.last_error",
                    Detail = "system.last_error.none",
                    Level = "ok",
                    Percentage = 0
                }
                : new AdminSystemStatusItemDto
                {
                    Label = "system.last_error",
                    Detail = $"{lastError.Method} {lastError.Path} - {lastError.Message}",
                    Level = "critical",
                    Percentage = 100
                });

            return items;
        }

        public async Task<int> GetPendingCountAsync(Guid currentUserId)
        {
            var breakdown = await GetPendingCountBreakdownAsync(currentUserId);
            return breakdown.Count;
        }

        public async Task<AdminPendingCountDto> GetPendingCountBreakdownAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name == RoleNames.SuperAdmin || user.Role.Name == RoleNames.TouristOrganization)
            {
                var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
                var destinationIdsQuery = destinationQuery.Select(d => d.Id);
                var eventCount = await _db.SubmissionQueue.CountAsync(q =>
                    q.Status == "Pending" &&
                    q.EntityType.ToLower() == "event" &&
                    destinationIdsQuery.Contains(q.DestinationId));
                var pendingPlaceCount = await _db.SubmissionQueue.CountAsync(q =>
                    q.Status == "Pending" &&
                    q.EntityType.ToLower() == "place" &&
                    destinationIdsQuery.Contains(q.DestinationId));

                return new AdminPendingCountDto
                {
                    Count = eventCount + pendingPlaceCount,
                    EventCount = eventCount,
                    PlaceCount = pendingPlaceCount
                };
            }

            // place_owner: count their own pending submissions + pending places they created
            var pendingEventSubmissions = await _db.SubmissionQueue.CountAsync(q =>
                q.Status == "Pending" &&
                q.EntityType.ToLower() == "event" &&
                q.SubmittedByUserId == currentUserId);
            var pendingPlaceSubmissions = await _db.SubmissionQueue.CountAsync(q =>
                q.Status == "Pending" &&
                q.EntityType.ToLower() == "place" &&
                q.SubmittedByUserId == currentUserId);

            var queuedPlaceIds = _db.SubmissionQueue
                .Where(q => q.EntityType == "place" && q.SubmittedByUserId == currentUserId)
                .Select(q => q.EntityId);

            var pendingPlaces = await _db.Places
                .IgnoreQueryFilters()
                .CountAsync(p =>
                    !p.IsDeleted &&
                    p.CreatedBy == currentUserId &&
                    p.ApprovalStatus == "pending" &&
                    !queuedPlaceIds.Contains(p.Id));

            var placeCount = pendingPlaceSubmissions + pendingPlaces;
            return new AdminPendingCountDto
            {
                Count = pendingEventSubmissions + placeCount,
                EventCount = pendingEventSubmissions,
                PlaceCount = placeCount
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

        private IQueryable<SupportTicket> BuildSupportTicketScope(User user, IQueryable<Guid> destinationIdsQuery)
        {
            var query = _db.SupportTickets.AsQueryable();

            if (user.Role.Name == RoleNames.SuperAdmin)
                return query.Where(t => t.IsEscalated || t.AssignedToUserId == user.Id);

            return query.Where(t =>
                t.AssignedToUserId == user.Id ||
                t.CreatedByAdminId == user.Id ||
                (t.LinkedContextType == SupportLinkedContextTypes.Destination &&
                 t.LinkedContextId.HasValue &&
                 destinationIdsQuery.Contains(t.LinkedContextId.Value)));
        }

        private IQueryable<Place> BuildOwnerPlaceScope(Guid ownerId)
        {
            return _db.Places
                .IgnoreQueryFilters()
                .Where(p => !p.IsDeleted && p.CreatedBy == ownerId);
        }

        private IQueryable<Event> BuildOwnerEventScope(Guid ownerId)
        {
            var ownerPlaceIdsQuery = BuildOwnerPlaceScope(ownerId).Select(p => p.Id);

            return _db.Events
                .IgnoreQueryFilters()
                .Where(e =>
                    !e.IsDeleted &&
                    (e.CreatedBy == ownerId ||
                     (e.PlaceId.HasValue && ownerPlaceIdsQuery.Contains(e.PlaceId.Value))));
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

        private async Task<AdminPopularEntityDto?> GetMostPopularOwnerDestinationAsync(Guid ownerId)
        {
            var ownerPlaceDestinationIds = BuildOwnerPlaceScope(ownerId)
                .Where(p => p.DestinationId.HasValue)
                .Select(p => p.DestinationId!.Value);

            var ownerEventDestinationIds = BuildOwnerEventScope(ownerId)
                .Where(e => e.DestinationId.HasValue)
                .Select(e => e.DestinationId!.Value);

            var top = await _db.PopularityLogs
                .Where(l =>
                    l.EntityType == "destination" &&
                    l.Source == "click" &&
                    (ownerPlaceDestinationIds.Contains(l.EntityId) ||
                     ownerEventDestinationIds.Contains(l.EntityId)))
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

        private async Task<AdminPopularEntityDto?> GetMostPopularOwnerEntityAsync(Guid ownerId)
        {
            var ownerPlaceIdsQuery = BuildOwnerPlaceScope(ownerId).Select(p => p.Id);
            var ownerEventIdsQuery = BuildOwnerEventScope(ownerId).Select(e => e.Id);

            var top = await _db.PopularityLogs
                .Where(l =>
                    l.Source == "click" &&
                    ((l.EntityType == "place" && ownerPlaceIdsQuery.Contains(l.EntityId)) ||
                     (l.EntityType == "event" && ownerEventIdsQuery.Contains(l.EntityId))))
                .GroupBy(l => new { l.EntityType, l.EntityId })
                .Select(g => new
                {
                    g.Key.EntityType,
                    g.Key.EntityId,
                    Views = g.Count()
                })
                .OrderByDescending(x => x.Views)
                .FirstOrDefaultAsync();

            if (top == null)
                return null;

            var name = top.EntityType switch
            {
                "place" => await BuildOwnerPlaceScope(ownerId)
                    .Where(p => p.Id == top.EntityId)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync(),
                "event" => await BuildOwnerEventScope(ownerId)
                    .Where(e => e.Id == top.EntityId)
                    .Select(e => e.Name)
                    .FirstOrDefaultAsync(),
                _ => null
            };

            return string.IsNullOrWhiteSpace(name)
                ? null
                : new AdminPopularEntityDto
                {
                    EntityType = top.EntityType,
                    EntityId = top.EntityId,
                    Name = name,
                    Views = top.Views
                };
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
