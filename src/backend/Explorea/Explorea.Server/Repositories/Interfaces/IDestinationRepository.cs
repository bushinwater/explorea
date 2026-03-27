using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IDestinationRepository : IBaseRepository<Destination>
    {
        Task<Destination?> GetBySlugAsync(string slug);
        Task<(List<Destination> Items, int Total)> GetPagedAsync(
            int? cityId, int? regionId, bool? featured, int page, int pageSize);
    }
}