using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IAdminEventRepository
    {
        Task<(List<Event> Items, int Total)> GetAdminPagedAsync(
            string? search,
            Guid? destinationId, int? cityId, int? typeId,
            DateTimeOffset? startFrom, DateTimeOffset? startTo,
            List<Guid>? restrictToDestinationIds, List<int>? restrictToCityIds,
            int page, int pageSize);

        Task<Event?> GetAdminByIdAsync(Guid id);

        Task AddAsync(Event ev);
        void Update(Event ev);
        Task<int> SaveChangesAsync();
    }
}
