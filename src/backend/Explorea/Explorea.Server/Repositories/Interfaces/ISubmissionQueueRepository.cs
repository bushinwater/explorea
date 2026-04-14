using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ISubmissionQueueRepository
    {
        Task<SubmissionQueue?> GetByIdAsync(Guid id);
        Task<(List<SubmissionQueue> Items, int Total)> GetPagedAsync(
            Guid? destinationId, string? status, int page, int pageSize);
        Task<List<SubmissionQueue>> GetPendingOwnerReviewAsync(Guid ownerId);
        Task AddAsync(SubmissionQueue item);
        Task<int> SaveChangesAsync();
    }
}
