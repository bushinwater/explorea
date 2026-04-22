using Explorea.API.DTOs.Admin.User;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminUserService : IAdminUserService
    {
        private static readonly string[] ToExcludedRoles =
        [
            RoleNames.SuperAdmin,
            RoleNames.TouristOrganization
        ];

        private readonly IUserRepository _userRepository;
        private readonly IOrganizationRegionAssignmentRepository _organizationRegionAssignmentRepository;

        public AdminUserService(
            IUserRepository userRepository,
            IOrganizationRegionAssignmentRepository organizationRegionAssignmentRepository)
        {
            _userRepository = userRepository;
            _organizationRegionAssignmentRepository = organizationRegionAssignmentRepository;
        }

        public async Task<(List<AdminUserDirectoryItemDto> Items, int Total)> GetDirectoryAsync(
            AdminUserDirectoryQueryDto query,
            Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);
            var normalizedQuery = NormalizeQuery(query);

            return await _userRepository.GetAdminDirectoryAsync(
                normalizedQuery,
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        public async Task<AdminUserDirectoryStatsDto> GetStatsAsync(Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);

            return await _userRepository.GetAdminDirectoryStatsAsync(
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        public async Task<List<AdminUserDirectoryRegionDto>> GetRegionsAsync(Guid currentUserId)
        {
            var scope = await ResolveScopeAsync(currentUserId);

            return await _userRepository.GetAdminDirectoryRegionsAsync(
                scope.VisibleRegionIds,
                scope.IncludeUsersWithoutLocation,
                scope.ExcludedRoles);
        }

        private async Task<AdminUserScope> ResolveScopeAsync(Guid currentUserId)
        {
            var currentUser = await _userRepository.GetByIdWithRoleAsync(currentUserId);
            if (currentUser == null)
                throw new UnauthorizedAccessException("Current user was not found.");

            if (currentUser.Role.Name == RoleNames.SuperAdmin)
            {
                return new AdminUserScope(
                    VisibleRegionIds: null,
                    IncludeUsersWithoutLocation: true,
                    ExcludedRoles: Array.Empty<string>());
            }

            if (currentUser.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");

            var assignedRegions = await _organizationRegionAssignmentRepository.GetByUserIdAsync(currentUserId);
            var visibleRegionIds = assignedRegions
                .Select(a => a.RegionId)
                .Distinct()
                .ToList();

            // If TO has no assigned regions yet, they should still see users without saved location.
            if (visibleRegionIds.Count == 0)
                visibleRegionIds.Add(-1);

            return new AdminUserScope(
                VisibleRegionIds: visibleRegionIds,
                IncludeUsersWithoutLocation: true,
                ExcludedRoles: ToExcludedRoles);
        }

        private static AdminUserDirectoryQueryDto NormalizeQuery(AdminUserDirectoryQueryDto query)
        {
            return new AdminUserDirectoryQueryDto
            {
                Search = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim(),
                Role = NormalizeOptionalFilter(query.Role),
                RegionId = query.RegionId,
                Status = NormalizeOptionalFilter(query.Status),
                Gender = NormalizeOptionalFilter(query.Gender),
                AgeBucket = NormalizeOptionalFilter(query.AgeBucket),
                Page = query.Page < 1 ? 1 : query.Page,
                PageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100)
            };
        }

        private static string? NormalizeOptionalFilter(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var normalized = value.Trim();
            return string.Equals(normalized, "all", StringComparison.OrdinalIgnoreCase)
                ? null
                : normalized;
        }

        private sealed record AdminUserScope(
            IReadOnlyCollection<int>? VisibleRegionIds,
            bool IncludeUsersWithoutLocation,
            IReadOnlyCollection<string> ExcludedRoles);
    }
}
