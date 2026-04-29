using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ISupportRepository : IBaseRepository<SupportTicket>
    {
        Task<(List<SupportTicket> Items, int Total)> GetUserTicketsAsync(
            Guid ownerUserId,
            string? status,
            int page,
            int pageSize);

        Task<(List<SupportTicket> Items, int Total)> GetAdminTicketsAsync(
            Guid assignedToUserId,
            string? status,
            int page,
            int pageSize);

        Task<(List<SupportTicket> Items, int Total)> GetSuperAdminTicketsAsync(
            string? status,
            string? priority,
            bool? isEscalated,
            int page,
            int pageSize);

        Task<SupportTicket?> GetTicketDetailAsync(Guid ticketId, bool includeInternalMessages);
        Task AddMessageAsync(SupportMessage message);
    }
}
