using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class SupportRepository : BaseRepository<SupportTicket>, ISupportRepository
    {
        public SupportRepository(AppDbContext db) : base(db) { }

        public async Task<(List<SupportTicket> Items, int Total)> GetUserTicketsAsync(
            Guid ownerUserId,
            string? status,
            int page,
            int pageSize)
        {
            var query = BuildTicketListQuery()
                .Where(t => t.OwnerUserId == ownerUserId);

            query = ApplyStatusFilter(query, status);

            return await PageTicketsAsync(query, page, pageSize);
        }

        public async Task<(List<SupportTicket> Items, int Total)> GetAdminTicketsAsync(
            Guid assignedToUserId,
            string? status,
            int page,
            int pageSize)
        {
            var query = BuildTicketListQuery()
                .Where(t => t.AssignedToUserId == assignedToUserId);

            query = ApplyStatusFilter(query, status);

            return await PageTicketsAsync(query, page, pageSize);
        }

        public async Task<(List<SupportTicket> Items, int Total)> GetSuperAdminTicketsAsync(
            string? status,
            string? priority,
            bool? isEscalated,
            int page,
            int pageSize)
        {
            var query = BuildTicketListQuery();

            query = ApplyStatusFilter(query, status);

            if (!string.IsNullOrWhiteSpace(priority))
            {
                var normalizedPriority = priority.Trim().ToLower();
                query = query.Where(t => t.Priority.ToLower() == normalizedPriority);
            }

            if (isEscalated.HasValue)
                query = query.Where(t => t.IsEscalated == isEscalated.Value);

            return await PageTicketsAsync(query, page, pageSize);
        }

        public async Task<SupportTicket?> GetTicketDetailAsync(Guid ticketId, bool includeInternalMessages)
        {
            var query = _db.SupportTickets
                .Include(t => t.OwnerUser)
                .Include(t => t.AssignedToUser)
                .Include(t => t.CreatedByAdmin)
                .Include(t => t.EscalatedByUser)
                .AsQueryable();

            query = includeInternalMessages
                ? query.Include(t => t.Messages.OrderBy(m => m.CreatedAt))
                    .ThenInclude(m => m.SenderUser)
                : query.Include(t => t.Messages
                        .Where(m => !m.IsInternal)
                        .OrderBy(m => m.CreatedAt))
                    .ThenInclude(m => m.SenderUser);

            return await query.FirstOrDefaultAsync(t => t.Id == ticketId);
        }

        public async Task AddMessageAsync(SupportMessage message)
        {
            await _db.SupportMessages.AddAsync(message);
        }

        private IQueryable<SupportTicket> BuildTicketListQuery()
        {
            return _db.SupportTickets
                .AsNoTracking()
                .Include(t => t.OwnerUser)
                .Include(t => t.AssignedToUser)
                .Include(t => t.Messages)
                .AsQueryable();
        }

        private static IQueryable<SupportTicket> ApplyStatusFilter(
            IQueryable<SupportTicket> query,
            string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return query;

            var normalizedStatus = status.Trim().ToLower();
            return query.Where(t => t.Status.ToLower() == normalizedStatus);
        }

        private static async Task<(List<SupportTicket> Items, int Total)> PageTicketsAsync(
            IQueryable<SupportTicket> query,
            int page,
            int pageSize)
        {
            var normalizedPage = page < 1 ? 1 : page;
            var normalizedPageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(t => t.LastActivityAt)
                .Skip((normalizedPage - 1) * normalizedPageSize)
                .Take(normalizedPageSize)
                .ToListAsync();

            return (items, total);
        }
    }
}
