using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ISubmissionQueueRepository
    {
        Task<SubmissionQueue?> GetByIdAsync(Guid id);
        Task<(List<SubmissionQueue> Items, int Total)> GetPagedAsync(
            Guid? destinationId, string? status, string? entityType, int page, int pageSize);
        Task<List<SubmissionQueue>> GetPendingOwnerReviewAsync(Guid ownerId);
        Task AddAsync(SubmissionQueue item);
        Task<int> SaveChangesAsync();

        Task<int> CountAsync(
            string? entityType,
            IReadOnlyCollection<string>? statuses,
            List<Guid>? restrictToDestinationIds,
            DateTimeOffset? reviewedByTOFrom = null,
            DateTimeOffset? reviewedByTOTo = null);
    }
}
