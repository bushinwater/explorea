using Explorea.API.DTOs.Admin.Activity;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services.Admin
{
    public class AdminActivityFeedService : IAdminActivityFeedService
    {
        private readonly AppDbContext _db;
        private readonly IUserRepository _userRepository;
        private readonly IOrganizationAssignmentRepository _assignmentRepository;
        private readonly IAdminActivityLogService _activityLogService;

        public AdminActivityFeedService(
            AppDbContext db,
            IUserRepository userRepository,
            IOrganizationAssignmentRepository assignmentRepository,
            IAdminActivityLogService activityLogService)
        {
            _db = db;
            _userRepository = userRepository;
            _assignmentRepository = assignmentRepository;
            _activityLogService = activityLogService;
        }

        public async Task<AdminActivityPageDto> GetAllPagedAsync(Guid currentUserId, int page, int pageSize)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var clampedPage = Math.Max(1, page);
            var clampedSize = Math.Clamp(pageSize, 5, 50);
            const int maxFetch = 500;

            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIds = await destinationQuery.Select(d => d.Id).ToListAsync();

            var all = new List<AdminRecentActivityDto>();
            all.AddRange(await GetRecentAdminLogEventsAsync(maxFetch));
            all.AddRange(await GetRecentDestinationEventsAsync(destinationIds, maxFetch));
            all.AddRange(await GetRecentUserEventsAsync(user, maxFetch));
            all.AddRange(await GetRecentSubmissionEventsAsync(destinationIds, maxFetch));
            all.AddRange(await GetRecentReviewEventsAsync(destinationIds, maxFetch));

            var sorted = all.OrderByDescending(e => e.CreatedAt).ToList();
            var totalCount = sorted.Count;
            var items = sorted.Skip((clampedPage - 1) * clampedSize).Take(clampedSize).ToList();

            return new AdminActivityPageDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = clampedPage,
                PageSize = clampedSize
            };
        }

        public async Task<List<AdminRecentActivityDto>> GetRecentAsync(Guid currentUserId, int limit)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            var take = Math.Clamp(limit, 1, 50);

            if (user.Role.Name == RoleNames.PlaceOwner)
            {
                return await GetOwnerRecentActivityAsync(currentUserId, take);
            }

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIds = await destinationQuery.Select(d => d.Id).ToListAsync();

            var events = new List<AdminRecentActivityDto>();
            events.AddRange(await GetRecentAdminLogEventsAsync(take));
            events.AddRange(await GetRecentDestinationEventsAsync(destinationIds, take));
            events.AddRange(await GetRecentUserEventsAsync(user, take));
            events.AddRange(await GetRecentSubmissionEventsAsync(destinationIds, take));
            events.AddRange(await GetRecentReviewEventsAsync(destinationIds, take));

            return events
                .OrderByDescending(e => e.CreatedAt)
                .Take(take)
                .ToList();
        }

        private async Task<List<AdminRecentActivityDto>> GetOwnerRecentActivityAsync(Guid ownerId, int take)
        {
            var ownerPlaceIds = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => p.CreatedBy == ownerId)
                .Select(p => p.Id)
                .ToListAsync();

            var events = new List<AdminRecentActivityDto>();

            // Places the owner created
            events.AddRange(await _db.Places
                .IgnoreQueryFilters()
                .Where(p => p.CreatedBy == ownerId)
                .OrderByDescending(p => p.CreatedAt)
                .Take(take)
                .Select(p => new AdminRecentActivityDto
                {
                    Id = $"place-created-{p.Id}",
                    Type = "place_created",
                    Description = $"Objekat kreiran: {p.Name}",
                    CreatedAt = p.CreatedAt,
                    ActorId = p.CreatedBy
                })
                .ToListAsync());

            // Events the owner submitted
            events.AddRange(await _db.Events
                .IgnoreQueryFilters()
                .Where(e => e.CreatedBy == ownerId)
                .OrderByDescending(e => e.CreatedAt)
                .Take(take)
                .Select(e => new AdminRecentActivityDto
                {
                    Id = $"event-created-{e.Id}",
                    Type = "event_created",
                    Description = $"Dogadjaj podnet: {e.Name}",
                    CreatedAt = e.CreatedAt,
                    ActorId = e.CreatedBy
                })
                .ToListAsync());

            // Reviews on the owner's places
            if (ownerPlaceIds.Count > 0)
            {
                events.AddRange(await _db.Reviews
                    .Where(r => !r.IsDeleted && r.EntityType == "place" && ownerPlaceIds.Contains(r.EntityId))
                    .OrderByDescending(r => r.CreatedAt)
                    .Take(take)
                    .Select(r => new AdminRecentActivityDto
                    {
                        Id = $"review-{r.Id}",
                        Type = "review_created",
                        Description = $"Nova recenzija ({r.Rating}/5) na vasem objektu",
                        CreatedAt = r.CreatedAt,
                        ActorId = r.UserId
                    })
                    .ToListAsync());
            }

            return events
                .OrderByDescending(e => e.CreatedAt)
                .Take(take)
                .ToList();
        }

        private async Task<List<AdminRecentActivityDto>> GetRecentAdminLogEventsAsync(int take)
        {
            var logs = await _activityLogService.GetRecentAsync(take);

            return logs.Select(log => new AdminRecentActivityDto
            {
                Id = $"admin-log-{log.Id}",
                Type = log.Type,
                Description = log.Description,
                CreatedAt = log.CreatedAt,
                ActorId = log.ActorId
            }).ToList();
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
            var destinationIds = assignments
                .Select(a => a.DestinationId)
                .ToList();

            return query.Where(d => destinationIds.Contains(d.Id));
        }

        private async Task<List<AdminRecentActivityDto>> GetRecentDestinationEventsAsync(
            IReadOnlyCollection<Guid> destinationIds,
            int take)
        {
            return await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => !d.IsDeleted && destinationIds.Contains(d.Id))
                .OrderByDescending(d => d.CreatedAt)
                .Take(take)
                .Select(d => new AdminRecentActivityDto
                {
                    Id = $"destination-created-{d.Id}",
                    Type = "destination_created",
                    Description = $"Nova destinacija kreirana: {d.Name}",
                    CreatedAt = d.CreatedAt,
                    ActorId = d.CreatedBy
                })
                .ToListAsync();
        }

        private async Task<List<AdminRecentActivityDto>> GetRecentUserEventsAsync(User admin, int take)
        {
            var query = _db.Users
                .Include(u => u.Role)
                .Include(u => u.CurrentCity)
                .AsQueryable();

            if (admin.Role.Name == RoleNames.TouristOrganization)
            {
                query = query.Where(u =>
                    u.Role.Name != RoleNames.SuperAdmin &&
                    u.Role.Name != RoleNames.TouristOrganization);

                if (admin.ManagedRegionId.HasValue)
                {
                    var regionId = admin.ManagedRegionId.Value;
                    query = query.Where(u =>
                        u.ManagedRegionId == regionId ||
                        (u.CurrentCity != null && u.CurrentCity.RegionId == regionId));
                }
            }

            return await query
                .OrderByDescending(u => u.CreatedAt)
                .Take(take)
                .Select(u => new AdminRecentActivityDto
                {
                    Id = $"user-registered-{u.Id}",
                    Type = "user_registered",
                    Description = $"Korisnik se registrovao: {u.FirstName} {u.LastName}",
                    CreatedAt = u.CreatedAt,
                    ActorId = u.Id
                })
                .ToListAsync();
        }

        private async Task<List<AdminRecentActivityDto>> GetRecentSubmissionEventsAsync(
            IReadOnlyCollection<Guid> destinationIds,
            int take)
        {
            var submissions = await _db.SubmissionQueue
                .Include(q => q.SubmittedByUser)
                .Include(q => q.Destination)
                .Where(q => destinationIds.Contains(q.DestinationId))
                .OrderByDescending(q => q.SubmittedAt)
                .Take(take)
                .ToListAsync();

            return submissions.Select(q => new AdminRecentActivityDto
            {
                Id = $"submission-{q.Id}",
                Type = q.Status.Equals("Pending", StringComparison.OrdinalIgnoreCase)
                    ? "submission_created"
                    : (q.Status.Contains("Rejected") ? "submission_rejected" : "submission_approved"),
                Description = q.Status.Equals("Pending", StringComparison.OrdinalIgnoreCase)
                    ? $"{EntityTypeLabel(q.EntityType)} ceka odobrenje za destinaciju {q.Destination.Name}"
                    : $"{EntityTypeLabel(q.EntityType)} je promenio status na {StatusLabel(q.Status)}",
                CreatedAt = q.ReviewedByTOAt ?? q.ReviewedByOwnerAt ?? q.SubmittedAt,
                ActorId = q.ReviewedByTOUserId ?? q.ReviewedByOwnerId ?? q.SubmittedByUserId
            }).ToList();
        }

        private async Task<List<AdminRecentActivityDto>> GetRecentReviewEventsAsync(
            IReadOnlyCollection<Guid> destinationIds,
            int take)
        {
            var placeIds = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => !p.IsDeleted && p.DestinationId.HasValue && destinationIds.Contains(p.DestinationId.Value))
                .Select(p => p.Id)
                .ToListAsync();

            var eventIds = await _db.Events
                .IgnoreQueryFilters()
                .Where(e => !e.IsDeleted && e.DestinationId.HasValue && destinationIds.Contains(e.DestinationId.Value))
                .Select(e => e.Id)
                .ToListAsync();

            var activityIds = await _db.Activities
                .IgnoreQueryFilters()
                .Where(a => !a.IsDeleted && a.DestinationId.HasValue && destinationIds.Contains(a.DestinationId.Value))
                .Select(a => a.Id)
                .ToListAsync();

            var reviews = await _db.Reviews
                .Include(r => r.User)
                .Where(r =>
                    !r.IsDeleted &&
                    ((r.EntityType == "destination" && destinationIds.Contains(r.EntityId)) ||
                     (r.EntityType == "place" && placeIds.Contains(r.EntityId)) ||
                     (r.EntityType == "event" && eventIds.Contains(r.EntityId)) ||
                     (r.EntityType == "activity" && activityIds.Contains(r.EntityId))))
                .OrderByDescending(r => r.CreatedAt)
                .Take(take)
                .ToListAsync();

            var entityIds = reviews.Select(r => r.EntityId).ToHashSet();

            var destNames = await _db.Destinations
                .IgnoreQueryFilters()
                .Where(d => entityIds.Contains(d.Id))
                .Select(d => new { d.Id, d.Name })
                .ToDictionaryAsync(d => d.Id, d => d.Name);

            var placeNames = await _db.Places
                .IgnoreQueryFilters()
                .Where(p => entityIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name })
                .ToDictionaryAsync(p => p.Id, p => p.Name);

            var eventNames = await _db.Events
                .IgnoreQueryFilters()
                .Where(e => entityIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Name })
                .ToDictionaryAsync(e => e.Id, e => e.Name);

            var activityNames = await _db.Activities
                .IgnoreQueryFilters()
                .Where(a => entityIds.Contains(a.Id))
                .Select(a => new { a.Id, a.Name })
                .ToDictionaryAsync(a => a.Id, a => a.Name);

            return reviews.Select(r =>
            {
                var entityName = r.EntityType.ToLowerInvariant() switch
                {
                    "destination" => destNames.GetValueOrDefault(r.EntityId),
                    "place" => placeNames.GetValueOrDefault(r.EntityId),
                    "event" => eventNames.GetValueOrDefault(r.EntityId),
                    "activity" => activityNames.GetValueOrDefault(r.EntityId),
                    _ => null
                };
                var entityLabel = EntityTypeLabel(r.EntityType).ToLower();
                var entityDesc = entityName != null ? $"{entityLabel} \"{entityName}\"" : entityLabel;

                return new AdminRecentActivityDto
                {
                    Id = $"review-created-{r.Id}",
                    Type = "review_created",
                    Description = $"{r.User.FirstName} {r.User.LastName} je dodao recenziju ({r.Rating}/5) za {entityDesc}",
                    CreatedAt = r.CreatedAt,
                    ActorId = r.UserId
                };
            }).ToList();
        }

        private static string EntityTypeLabel(string entityType) => entityType.ToLowerInvariant() switch
        {
            "destination" => "Destinacija",
            "place" => "Objekat",
            "event" => "Dogadjaj",
            "activity" => "Aktivnost",
            _ => "Entitet"
        };

        private static string StatusLabel(string status) => status switch
        {
            "Pending"         => "Na čekanju",
            "ApprovedByTO"    => "Odobrio turistički radnik",
            "RejectedByTO"    => "Odbio turistički radnik",
            "ApprovedByOwner" => "Odobrio vlasnik",
            "RejectedByOwner" => "Odbio vlasnik",
            _                 => status
        };
    }
}
