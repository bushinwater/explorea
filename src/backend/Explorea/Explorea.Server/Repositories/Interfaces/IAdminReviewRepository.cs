using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminReviewRepository
    {
        Task<(List<Review> Items, int Total)> GetAdminPagedAsync(
            string? entityType,
            int? subtypeId,
            int? cityId,
            int? regionId,
            short? minRating,
            short? maxRating,
            string? gender,
            int? minAge,
            int? maxAge,
            bool? isHidden,
            List<Guid>? restrictToDestinationIds,
            List<int>? restrictToCityIds,
            Guid? placeOwnerUserId,
            int page,
            int pageSize,
            string? search = null,
            List<string>? extraFilters = null);

        Task<Review?> GetAdminByIdAsync(Guid id);
        void Update(Review review);
        void Remove(Review review);
        Task<int> SaveChangesAsync();
    }
}
