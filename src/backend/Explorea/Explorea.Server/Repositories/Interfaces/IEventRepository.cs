using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface IEventRepository : IBaseRepository<Event>
    {
        Task<Event?> GetBySlugAsync(string slug);
        Task<(List<Event> Items, int Total)> GetPagedAsync(
            int? cityId, int? typeId, DateTimeOffset? from,
            DateTimeOffset? to, bool? free, int page, int pageSize);
        Task<List<Event>> GetByMonthAsync(int year, int month);

        Task<List<Event>> GetByMonthFilteredAsync(
            int year,
            int month,
            int? cityId,
            int? typeId,
            bool? free);
    }
}