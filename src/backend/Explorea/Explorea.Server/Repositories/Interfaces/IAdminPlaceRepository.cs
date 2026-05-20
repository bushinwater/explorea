using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminPlaceRepository
    {
        Task<(List<Place> Items, int Total)> GetAdminPagedAsync(
            string? search,
            int? typeId,
            string? status,
            int? filterRegionId,
            decimal? minRating,
            Guid? destinationId,
            int? amenityId,
            Guid? restrictToOwner,
            int? restrictToRegionId,
            int page,
            int pageSize);

        Task<Place?> GetAdminByIdAsync(Guid id);

        Task<List<Place>> GetMyPlacesAsync(Guid ownerId);

        Task AddAsync(Place place);
        void Update(Place place);
        Task ReplaceWorkingDaysAsync(Guid placeId, List<PlaceWorkingDay> workingDays);
        void RemoveImages(IEnumerable<PlaceImage> images);
        void RemoveAmenityLinks(IEnumerable<PlaceAmenityLink> links);
        void RemoveWorkingDays(IEnumerable<PlaceWorkingDay> workingDays);
        Task<int> SaveChangesAsync();
    }
}
