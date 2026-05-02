using Explorea.API.DTOs.Admin.Support;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Support;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminSupportService : IAdminSupportService
    {
        private readonly ISupportRepository _supportRepository;
        private readonly IUserRepository _userRepository;

        public AdminSupportService(
            ISupportRepository supportRepository,
            IUserRepository userRepository)
        {
            _supportRepository = supportRepository;
            _userRepository = userRepository;
        }

        public async Task<PagedResultDto<SupportTicketListItemDto>> GetTicketsAsync(
            AdminSupportTicketQueryDto query,
            Guid currentUserId)
        {
            await EnsureTouristOrganizationAsync(currentUserId);

            var page = NormalizePage(query.Page);
            var pageSize = NormalizePageSize(query.PageSize);
            var status = NormalizeOptionalStatus(query.Status);

            var (items, total) = await _supportRepository.GetAdminTicketsAsync(
                currentUserId,
                status,
                page,
                pageSize);

            return new PagedResultDto<SupportTicketListItemDto>
            {
                Items = items.Select(t => MapListItem(t, includeInternalMessages: true)).ToList(),
                Total = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<SupportTicketDetailDto?> GetByIdAsync(Guid id, Guid currentUserId)
        {
            await EnsureTouristOrganizationAsync(currentUserId);

            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null || ticket.AssignedToUserId != currentUserId)
                return null;

            return MapDetail(ticket, includeInternalMessages: true);
        }

        public async Task<SupportMessageDto> AddMessageAsync(
            Guid id,
            AdminCreateSupportMessageDto dto,
            Guid currentUserId)
        {
            await EnsureTouristOrganizationAsync(currentUserId);

            var content = RequireText(dto.Content, "Content");
            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null || ticket.AssignedToUserId != currentUserId)
                throw new KeyNotFoundException("Support ticket was not found.");

            if (ticket.Status == SupportTicketStatuses.Closed)
                throw new InvalidOperationException("Closed support tickets cannot receive new messages.");

            var now = DateTimeOffset.UtcNow;
            var message = new SupportMessage
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                SenderUserId = currentUserId,
                SenderType = SupportSenderTypes.ToAdmin,
                Content = content,
                IsInternal = dto.IsInternal,
                CreatedAt = now
            };

            ticket.LastActivityAt = now;
            if (!dto.IsInternal && ticket.Status == SupportTicketStatuses.Open)
                ticket.Status = SupportTicketStatuses.InProgress;

            _supportRepository.Update(ticket);
            await _supportRepository.AddMessageAsync(message);
            await _supportRepository.SaveChangesAsync();

            return MapMessage(message, senderName: null);
        }

        public async Task<SupportTicketDetailDto> UpdateStatusAsync(
            Guid id,
            AdminUpdateSupportTicketStatusDto dto,
            Guid currentUserId)
        {
            await EnsureTouristOrganizationAsync(currentUserId);

            var status = NormalizeStatus(dto.Status);
            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null || ticket.AssignedToUserId != currentUserId)
                throw new KeyNotFoundException("Support ticket was not found.");

            ApplyStatus(ticket, status);
            _supportRepository.Update(ticket);
            await _supportRepository.SaveChangesAsync();

            var updated = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true)
                ?? throw new InvalidOperationException("Updated support ticket could not be loaded.");

            return MapDetail(updated, includeInternalMessages: true);
        }

        public async Task<SupportTicketDetailDto> EscalateAsync(Guid id, Guid currentUserId)
        {
            await EnsureTouristOrganizationAsync(currentUserId);

            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null || ticket.AssignedToUserId != currentUserId)
                throw new KeyNotFoundException("Support ticket was not found.");

            if (ticket.Status == SupportTicketStatuses.Closed)
                throw new InvalidOperationException("Closed support tickets cannot be escalated.");

            var now = DateTimeOffset.UtcNow;
            ticket.IsEscalated = true;
            ticket.EscalatedAt ??= now;
            ticket.EscalatedByUserId ??= currentUserId;
            ticket.LastActivityAt = now;

            await _supportRepository.AddMessageAsync(new SupportMessage
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                SenderUserId = currentUserId,
                SenderType = SupportSenderTypes.ToAdmin,
                Content = "Ticket escalated to superadmin.",
                IsInternal = true,
                CreatedAt = now
            });

            _supportRepository.Update(ticket);
            await _supportRepository.SaveChangesAsync();

            var updated = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true)
                ?? throw new InvalidOperationException("Escalated support ticket could not be loaded.");

            return MapDetail(updated, includeInternalMessages: true);
        }

        private async Task EnsureTouristOrganizationAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.TouristOrganization)
                throw new UnauthorizedAccessException("Access denied.");
        }

        private static void ApplyStatus(SupportTicket ticket, string status)
        {
            var now = DateTimeOffset.UtcNow;

            ticket.Status = status;
            ticket.LastActivityAt = now;

            if (status == SupportTicketStatuses.Resolved)
            {
                ticket.ResolvedAt = now;
                ticket.ClosedAt = null;
                return;
            }

            if (status == SupportTicketStatuses.Closed)
            {
                ticket.ClosedAt = now;
                if (!ticket.ResolvedAt.HasValue)
                    ticket.ResolvedAt = now;
                return;
            }

            ticket.ResolvedAt = null;
            ticket.ClosedAt = null;
        }

        private static string? NormalizeOptionalStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return null;

            return NormalizeStatus(status);
        }

        private static string NormalizeStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                throw new InvalidOperationException("Status is required.");

            var normalized = status.Trim().ToLower();
            if (!SupportTicketStatuses.All.Contains(normalized))
                throw new InvalidOperationException("Status must be one of: open, in_progress, resolved, closed.");

            return normalized;
        }

        private static string RequireText(string? value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException($"{fieldName} is required.");

            return value.Trim();
        }

        private static int NormalizePage(int page)
            => page < 1 ? 1 : page;

        private static int NormalizePageSize(int pageSize)
            => pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        private static SupportTicketListItemDto MapListItem(
            SupportTicket ticket,
            bool includeInternalMessages)
        {
            return new SupportTicketListItemDto
            {
                Id = ticket.Id,
                Title = ticket.Title,
                Status = ticket.Status,
                Priority = ticket.Priority,
                OwnerUserId = ticket.OwnerUserId,
                OwnerName = FormatUserName(ticket.OwnerUser),
                AssignedToUserId = ticket.AssignedToUserId,
                AssignedToName = FormatUserName(ticket.AssignedToUser),
                LinkedContextType = ticket.LinkedContextType,
                LinkedContextId = ticket.LinkedContextId,
                IsEscalated = ticket.IsEscalated,
                CreatedAt = ticket.CreatedAt,
                LastActivityAt = ticket.LastActivityAt,
                MessageCount = includeInternalMessages
                    ? ticket.Messages.Count
                    : ticket.Messages.Count(m => !m.IsInternal)
            };
        }

        private static SupportTicketDetailDto MapDetail(
            SupportTicket ticket,
            bool includeInternalMessages)
        {
            var messages = includeInternalMessages
                ? ticket.Messages
                : ticket.Messages.Where(m => !m.IsInternal);

            return new SupportTicketDetailDto
            {
                Id = ticket.Id,
                Title = ticket.Title,
                Status = ticket.Status,
                Priority = ticket.Priority,
                OwnerUserId = ticket.OwnerUserId,
                OwnerName = FormatUserName(ticket.OwnerUser),
                AssignedToUserId = ticket.AssignedToUserId,
                AssignedToName = FormatUserName(ticket.AssignedToUser),
                CreatedByAdminId = ticket.CreatedByAdminId,
                CreatedByAdminName = FormatUserName(ticket.CreatedByAdmin),
                LinkedContextType = ticket.LinkedContextType,
                LinkedContextId = ticket.LinkedContextId,
                IsEscalated = ticket.IsEscalated,
                EscalatedAt = ticket.EscalatedAt,
                EscalatedByUserId = ticket.EscalatedByUserId,
                CreatedAt = ticket.CreatedAt,
                LastActivityAt = ticket.LastActivityAt,
                ResolvedAt = ticket.ResolvedAt,
                ClosedAt = ticket.ClosedAt,
                Messages = messages
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => MapMessage(m, FormatUserName(m.SenderUser)))
                    .ToList()
            };
        }

        private static SupportMessageDto MapMessage(SupportMessage message, string? senderName)
        {
            return new SupportMessageDto
            {
                Id = message.Id,
                TicketId = message.TicketId,
                SenderUserId = message.SenderUserId,
                SenderType = message.SenderType,
                SenderName = senderName,
                Content = message.Content,
                IsInternal = message.IsInternal,
                CreatedAt = message.CreatedAt
            };
        }

        private static string? FormatUserName(User? user)
        {
            if (user == null)
                return null;

            return $"{user.FirstName} {user.LastName}".Trim();
        }
    }
}
