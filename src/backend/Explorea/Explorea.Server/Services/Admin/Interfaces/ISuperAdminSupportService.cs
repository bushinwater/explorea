using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.SuperAdmin.Support;
using Explorea.API.DTOs.Support;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface ISuperAdminSupportService
    {
        Task<PagedResultDto<SupportTicketListItemDto>> GetTicketsAsync(
            SuperAdminSupportTicketQueryDto query,
            Guid currentUserId);

        Task<SupportTicketDetailDto?> GetByIdAsync(Guid id, Guid currentUserId);

        Task<SupportMessageDto> AddMessageAsync(
            Guid id,
            SuperAdminCreateSupportMessageDto dto,
            Guid currentUserId);

        Task<SupportTicketDetailDto> UpdateAsync(
            Guid id,
            SuperAdminUpdateSupportTicketDto dto,
            Guid currentUserId);
    }
}
