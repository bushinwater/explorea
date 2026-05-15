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

        public AdminActivityFeedService(
            AppDbContext db,
            IUserRepository userRepository,
            IOrganizationAssignmentRepository assignmentRepository)
        {
            _db = db;
            _userRepository = userRepository;
            _assignmentRepository = assignmentRepository;
        }

        public async Task<List<AdminRecentActivityDto>> GetRecentAsync(Guid currentUserId, int limit)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId)
                ?? throw new UnauthorizedAccessException("Current user was not found.");

            if (user.Role.Name != RoleNames.SuperAdmin && user.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var take = Math.Clamp(limit, 1, 50);
            var destinationQuery = await BuildDestinationScopeAsync(user, currentUserId);
            var destinationIds = await destinationQuery.Select(d => d.Id).ToListAsync();

            var events = new List<AdminRecentActivityDto>();
            events.AddRange(await GetRecentDestinationEventsAsync(destinationIds, take));
            events.AddRange(await GetRecentUserEventsAsync(user, take));
            events.AddRange(await GetRecentSubmissionEventsAsync(destinationIds, take));
            events.AddRange(await GetRecentReviewEventsAsync(destinationIds, take));

            return events
                .OrderByDescending(e => e.CreatedAt)
                .Take(take)
                .ToList();
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
                    : "submission_reviewed",
                Description = q.Status.Equals("Pending", StringComparison.OrdinalIgnoreCase)
                    ? $"{EntityTypeLabel(q.EntityType)} ceka odobrenje za destinaciju {q.Destination.Name}"
                    : $"{EntityTypeLabel(q.EntityType)} je promenio status na {q.Status}",
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

            return reviews.Select(r => new AdminRecentActivityDto
            {
                Id = $"review-created-{r.Id}",
                Type = "review_created",
                Description = $"{r.User.FirstName} {r.User.LastName} je dodao recenziju ({r.Rating}/5) za {EntityTypeLabel(r.EntityType).ToLower()}",
                CreatedAt = r.CreatedAt,
                ActorId = r.UserId
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
    }
}
