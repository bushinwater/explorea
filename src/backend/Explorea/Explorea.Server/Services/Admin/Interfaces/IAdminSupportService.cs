using Explorea.API.DTOs.Admin.Support;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Support;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminSupportService
    {
        Task<PagedResultDto<SupportTicketListItemDto>> GetTicketsAsync(
            AdminSupportTicketQueryDto query,
            Guid currentUserId);

        Task<SupportTicketDetailDto?> GetByIdAsync(Guid id, Guid currentUserId);

        Task<SupportMessageDto> AddMessageAsync(
            Guid id,
            AdminCreateSupportMessageDto dto,
            Guid currentUserId);

        Task<SupportTicketDetailDto> UpdateStatusAsync(
            Guid id,
            AdminUpdateSupportTicketStatusDto dto,
            Guid currentUserId);

        Task<SupportTicketDetailDto> EscalateAsync(Guid id, Guid currentUserId);
    }
}
