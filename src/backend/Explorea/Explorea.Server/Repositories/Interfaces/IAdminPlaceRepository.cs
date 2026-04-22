using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminPlaceRepository
    {
        Task<(List<Place> Items, int Total)> GetAdminPagedAsync(
            Guid? destinationId,
            int? cityId,
            int? typeId,
            bool? isFeatured,
            List<Guid>? restrictToDestinationIds,
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