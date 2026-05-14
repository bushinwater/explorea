using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.SuperAdmin.Support;
using Explorea.API.DTOs.Support;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class SuperAdminSupportService : ISuperAdminSupportService
    {
        private readonly ISupportRepository _supportRepository;
        private readonly IUserRepository _userRepository;

        public SuperAdminSupportService(
            ISupportRepository supportRepository,
            IUserRepository userRepository)
        {
            _supportRepository = supportRepository;
            _userRepository = userRepository;
        }

        public async Task<PagedResultDto<SupportTicketListItemDto>> GetTicketsAsync(
            SuperAdminSupportTicketQueryDto query,
            Guid currentUserId)
        {
            await EnsureSuperAdminAsync(currentUserId);

            var page = NormalizePage(query.Page);
            var pageSize = NormalizePageSize(query.PageSize);
            var status = NormalizeOptionalStatus(query.Status);
            var priority = NormalizeOptionalPriority(query.Priority);

            var (items, total) = await _supportRepository.GetSuperAdminTicketsAsync(
                currentUserId,
                status,
                priority,
                query.IsEscalated,
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
            await EnsureSuperAdminAsync(currentUserId);

            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null) return null;
            if (!ticket.IsEscalated && ticket.AssignedToUserId != currentUserId) return null;

            return MapDetail(ticket, includeInternalMessages: true);
        }

        public async Task<SupportMessageDto> AddMessageAsync(
            Guid id,
            SuperAdminCreateSupportMessageDto dto,
            Guid currentUserId)
        {
            await EnsureSuperAdminAsync(currentUserId);

            var content = RequireText(dto.Content, "Content");
            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null)
                throw new KeyNotFoundException("Support ticket was not found.");

            if (ticket.Status == SupportTicketStatuses.Closed)
                throw new InvalidOperationException("Closed support tickets cannot receive new messages.");

            var now = DateTimeOffset.UtcNow;
            var message = new SupportMessage
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                SenderUserId = currentUserId,
                SenderType = SupportSenderTypes.SuperAdmin,
                Content = content,
                IsInternal = dto.IsInternal,
                CreatedAt = now
            };

            ticket.LastActivityAt = now;

            _supportRepository.Update(ticket);
            await _supportRepository.AddMessageAsync(message);
            await _supportRepository.SaveChangesAsync();

            return MapMessage(message, senderName: null);
        }

        public async Task<SupportTicketDetailDto> UpdateAsync(
            Guid id,
            SuperAdminUpdateSupportTicketDto dto,
            Guid currentUserId)
        {
            await EnsureSuperAdminAsync(currentUserId);

            var status = NormalizeOptionalStatus(dto.Status);
            var priority = NormalizeOptionalPriority(dto.Priority);

            if (status == null && priority == null)
                throw new InvalidOperationException("Status or priority must be provided.");

            var ticket = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true);
            if (ticket == null)
                throw new KeyNotFoundException("Support ticket was not found.");

            if (priority != null)
                ticket.Priority = priority;

            if (status != null)
                ApplyStatus(ticket, status);
            else
                ticket.LastActivityAt = DateTimeOffset.UtcNow;

            _supportRepository.Update(ticket);
            await _supportRepository.SaveChangesAsync();

            var updated = await _supportRepository.GetTicketDetailAsync(id, includeInternalMessages: true)
                ?? throw new InvalidOperationException("Updated support ticket could not be loaded.");

            return MapDetail(updated, includeInternalMessages: true);
        }

        private async Task EnsureSuperAdminAsync(Guid currentUserId)
        {
            var user = await _userRepository.GetByIdWithRoleAsync(currentUserId);
            if (user?.Role.Name != RoleNames.SuperAdmin)
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

            var normalized = status.Trim().ToLower();
            if (!SupportTicketStatuses.All.Contains(normalized))
                throw new InvalidOperationException("Status must be one of: open, in_progress, resolved, closed.");

            return normalized;
        }

        private static string? NormalizeOptionalPriority(string? priority)
        {
            if (string.IsNullOrWhiteSpace(priority))
                return null;

            var normalized = priority.Trim().ToLower();
            if (!SupportTicketPriorities.All.Contains(normalized))
                throw new InvalidOperationException("Priority must be one of: low, medium, high.");

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
                    : ticket.Messages.Count(m => !m.IsInternal),
                LastMessage = ticket.Messages
                    .Where(m => !m.IsInternal)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Content)
                    .FirstOrDefault(),
                LastMessageAt = ticket.Messages
                    .Where(m => !m.IsInternal)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => (DateTimeOffset?)m.CreatedAt)
                    .FirstOrDefault(),
                SenderRole = ticket.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.SenderType)
                    .FirstOrDefault()
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
