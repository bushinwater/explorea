using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IPlaceRepository : IBaseRepository<Place>
    {
        Task<Place?> GetBySlugAsync(string slug);
        Task<(List<Place> Items, int Total)> GetPagedAsync(
            Guid? destinationId, int? cityId, int? typeId,
            decimal? minRating, bool? isOpen, int page, int pageSize);
    }
}