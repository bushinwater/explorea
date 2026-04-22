using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IDestinationRepository : IBaseRepository<Destination>
    {
        Task<Destination?> GetBySlugAsync(string slug);
        Task<(List<Destination> Items, int Total)> GetPagedAsync(
            int? cityId, int? regionId, bool? featured, int page, int pageSize);

        // Admin metode
        Task<(List<Destination> Items, int Total)> GetAdminPagedAsync(
            int? cityId, string? visibility, List<Guid>? restrictToIds, int page, int pageSize);
        Task<Destination?> GetAdminByIdAsync(Guid id);
        Task<List<int>> GetCityIdsByDestinationsAsync(List<Guid> destinationIds);
    }
}