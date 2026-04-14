using Explorea.API.DTOs.Admin.Queue;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminQueueService
    {
        Task<(List<QueueItemDto> Items, int Total)> GetQueueAsync(
            Guid? destinationId, string? status, int page, int pageSize, Guid currentUserId);

        Task<List<QueueItemDto>> GetOwnerQueueAsync(Guid currentUserId);

        Task ApproveByTOAsync(Guid queueItemId, Guid reviewerId);

        Task RejectByTOAsync(Guid queueItemId, Guid reviewerId, string reason);

        Task ApproveByOwnerAsync(Guid queueItemId, Guid ownerId);

        Task RejectByOwnerAsync(Guid queueItemId, Guid ownerId, string reason);
    }
}
