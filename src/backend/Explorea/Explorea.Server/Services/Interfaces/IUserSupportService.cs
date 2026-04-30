using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Support;

namespace Explorea.Server.Services.Interfaces
{
    public interface IUserSupportService
    {
        Task<SupportTicketDetailDto> CreateTicketAsync(Guid userId, CreateSupportTicketDto dto);
        Task<PagedResultDto<SupportTicketListItemDto>> GetMineAsync(Guid userId, SupportTicketQueryDto query);
        Task<SupportTicketDetailDto?> GetByIdAsync(Guid userId, Guid ticketId);
        Task<SupportMessageDto> AddMessageAsync(Guid userId, Guid ticketId, CreateSupportMessageDto dto);
    }
}
