using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Support;
using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class UserSupportService : IUserSupportService
    {
        private readonly ISupportRepository _supportRepository;
        private readonly AppDbContext _db;

        public UserSupportService(ISupportRepository supportRepository, AppDbContext db)
        {
            _supportRepository = supportRepository;
            _db = db;
        }

        public async Task<SupportTicketDetailDto> CreateTicketAsync(Guid userId, CreateSupportTicketDto dto)
        {
            var title = RequireText(dto.Title, "Title");
            var messageContent = RequireText(dto.Message, "Message");
            var priority = NormalizePriority(dto.Priority);
            var linkedContextType = NormalizeLinkedContext(dto.LinkedContextType, dto.LinkedContextId);
            var assignedToUserId = await ResolveAssignedToUserIdAsync(userId, linkedContextType, dto.LinkedContextId, dto.IsNonObjectRelated);
            var now = DateTimeOffset.UtcNow;

            var ticket = new SupportTicket
            {
                Id = Guid.NewGuid(),
                Title = title,
                Status = SupportTicketStatuses.Open,
                Priority = priority,
                OwnerUserId = userId,
                AssignedToUserId = assignedToUserId,
                LinkedContextType = linkedContextType,
                LinkedContextId = dto.LinkedContextId,
                CreatedAt = now,
                LastActivityAt = now
            };

            ticket.Messages.Add(new SupportMessage
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                SenderUserId = userId,
                SenderType = SupportSenderTypes.User,
                Content = messageContent,
                IsInternal = false,
                CreatedAt = now
            });

            await _supportRepository.AddAsync(ticket);
            await _supportRepository.SaveChangesAsync();

            var created = await _supportRepository.GetTicketDetailAsync(ticket.Id, includeInternalMessages: false)
                ?? throw new InvalidOperationException("Created support ticket could not be loaded.");

            return MapDetail(created, includeInternalMessages: false);
        }

        public async Task<PagedResultDto<SupportTicketListItemDto>> GetMineAsync(
            Guid userId,
            SupportTicketQueryDto query)
        {
            var page = NormalizePage(query.Page);
            var pageSize = NormalizePageSize(query.PageSize);
            var status = NormalizeOptionalStatus(query.Status);

            var (items, total) = await _supportRepository.GetUserTicketsAsync(
                userId,
                status,
                page,
                pageSize);

            return new PagedResultDto<SupportTicketListItemDto>
            {
                Items = items.Select(t => MapListItem(t, includeInternalMessages: false)).ToList(),
                Total = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<SupportTicketDetailDto?> GetByIdAsync(Guid userId, Guid ticketId)
        {
            var ticket = await _supportRepository.GetTicketDetailAsync(ticketId, includeInternalMessages: false);
            if (ticket == null || ticket.OwnerUserId != userId)
                return null;

            return MapDetail(ticket, includeInternalMessages: false);
        }

        public async Task<SupportMessageDto> AddMessageAsync(
            Guid userId,
            Guid ticketId,
            CreateSupportMessageDto dto)
        {
            var content = RequireText(dto.Content, "Content");
            var ticket = await _supportRepository.GetTicketDetailAsync(ticketId, includeInternalMessages: false);
            if (ticket == null || ticket.OwnerUserId != userId)
                throw new KeyNotFoundException("Support ticket was not found.");

            if (ticket.Status == SupportTicketStatuses.Closed)
                throw new InvalidOperationException("Closed support tickets cannot receive new messages.");

            var now = DateTimeOffset.UtcNow;
            var message = new SupportMessage
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                SenderUserId = userId,
                SenderType = SupportSenderTypes.User,
                Content = content,
                IsInternal = false,
                CreatedAt = now
            };

            ticket.LastActivityAt = now;
            if (ticket.Status == SupportTicketStatuses.Resolved)
            {
                ticket.Status = SupportTicketStatuses.Open;
                ticket.ResolvedAt = null;
            }

            _supportRepository.Update(ticket);
            await _supportRepository.AddMessageAsync(message);
            await _supportRepository.SaveChangesAsync();

            return MapMessage(message, senderName: null);
        }

        private async Task<Guid?> ResolveAssignedToUserIdAsync(
            Guid userId,
            string? linkedContextType,
            Guid? linkedContextId,
            bool isNonObjectRelated = false)
        {
            var creatorRole = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.Role.Name)
                .FirstOrDefaultAsync();

            // TO šalje tiket → ide superadminu sa najmanje tiketa
            if (creatorRole == RoleNames.TouristOrganization)
                return await _supportRepository.FindLeastLoadedUserByRoleAsync(RoleNames.SuperAdmin);

            // Tiket nevezan za objekat → ide TO-u sa najmanje tiketa globalno
            if (isNonObjectRelated || linkedContextType == null)
                return await _supportRepository.FindLeastLoadedUserByRoleAsync(RoleNames.TouristOrganization);

            // Tiket vezan za destinaciju/mesto/event/aktivnost → rutiranje po regiji
            var destinationId = await ResolveDestinationIdAsync(linkedContextType, linkedContextId);
            if (destinationId.HasValue)
            {
                var destinationCandidates = await _db.OrganizationAssignments
                    .Where(a => a.DestinationId == destinationId.Value)
                    .Select(a => a.OrganizationUserId)
                    .ToListAsync();

                var assignedFromDestination = await _supportRepository.FindLeastLoadedAmongAsync(destinationCandidates);
                if (assignedFromDestination.HasValue)
                    return assignedFromDestination;
            }

            var userRegionId = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.ManagedRegionId ?? u.CurrentCity!.RegionId)
                .FirstOrDefaultAsync();

            if (userRegionId.HasValue)
            {
                var regionCandidates = await _db.OrganizationRegionAssignments
                    .Where(a => a.RegionId == userRegionId.Value)
                    .Select(a => a.OrganizationUserId)
                    .ToListAsync();

                var assignedFromRegion = await _supportRepository.FindLeastLoadedAmongAsync(regionCandidates);
                if (assignedFromRegion.HasValue)
                    return assignedFromRegion;
            }

            return await _supportRepository.FindLeastLoadedUserByRoleAsync(RoleNames.TouristOrganization);
        }

        private async Task<Guid?> ResolveDestinationIdAsync(string? linkedContextType, Guid? linkedContextId)
        {
            if (linkedContextType == null || !linkedContextId.HasValue)
                return null;

            return linkedContextType switch
            {
                SupportLinkedContextTypes.Destination => await ResolveDestinationContextAsync(linkedContextId.Value),
                SupportLinkedContextTypes.Place => await ResolvePlaceDestinationAsync(linkedContextId.Value),
                SupportLinkedContextTypes.Event => await ResolveEventDestinationAsync(linkedContextId.Value),
                SupportLinkedContextTypes.Activity => await ResolveActivityDestinationAsync(linkedContextId.Value),
                _ => throw new InvalidOperationException("Unsupported linked context type.")
            };
        }

        private async Task<Guid?> ResolveDestinationContextAsync(Guid destinationId)
        {
            var exists = await _db.Destinations.AnyAsync(d => d.Id == destinationId);
            if (!exists)
                throw new KeyNotFoundException("Linked destination was not found.");

            return destinationId;
        }

        private async Task<Guid?> ResolvePlaceDestinationAsync(Guid placeId)
        {
            var place = await _db.Places
                .Where(p => p.Id == placeId)
                .Select(p => new { p.DestinationId })
                .FirstOrDefaultAsync();

            if (place == null)
                throw new KeyNotFoundException("Linked place was not found.");

            return place.DestinationId;
        }

        private async Task<Guid?> ResolveEventDestinationAsync(Guid eventId)
        {
            var eventContext = await _db.Events
                .Where(e => e.Id == eventId)
                .Select(e => new
                {
                    e.DestinationId,
                    PlaceDestinationId = e.Place != null ? e.Place.DestinationId : null
                })
                .FirstOrDefaultAsync();

            if (eventContext == null)
                throw new KeyNotFoundException("Linked event was not found.");

            return eventContext.DestinationId ?? eventContext.PlaceDestinationId;
        }

        private async Task<Guid?> ResolveActivityDestinationAsync(Guid activityId)
        {
            var activityContext = await _db.Activities
                .Where(a => a.Id == activityId)
                .Select(a => new
                {
                    a.DestinationId,
                    PlaceDestinationId = a.Place != null ? a.Place.DestinationId : null
                })
                .FirstOrDefaultAsync();

            if (activityContext == null)
                throw new KeyNotFoundException("Linked activity was not found.");

            return activityContext.DestinationId ?? activityContext.PlaceDestinationId;
        }

        private static string NormalizePriority(string? priority)
        {
            if (string.IsNullOrWhiteSpace(priority))
                return SupportTicketPriorities.Medium;

            var normalized = priority.Trim().ToLower();
            if (!SupportTicketPriorities.All.Contains(normalized))
                throw new InvalidOperationException("Priority must be one of: low, medium, high.");

            return normalized;
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

        private static string? NormalizeLinkedContext(string? linkedContextType, Guid? linkedContextId)
        {
            if (string.IsNullOrWhiteSpace(linkedContextType) && !linkedContextId.HasValue)
                return null;

            if (string.IsNullOrWhiteSpace(linkedContextType) || !linkedContextId.HasValue)
                throw new InvalidOperationException("Linked context type and id must be provided together.");

            var normalized = linkedContextType.Trim().ToLower();
            if (!SupportLinkedContextTypes.All.Contains(normalized))
                throw new InvalidOperationException("Linked context type must be one of: destination, place, event, activity.");

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
