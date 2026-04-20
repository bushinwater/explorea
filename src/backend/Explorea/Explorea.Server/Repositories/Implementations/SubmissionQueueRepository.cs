using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class SubmissionQueueRepository : ISubmissionQueueRepository
    {
        private readonly AppDbContext _db;

        public SubmissionQueueRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<SubmissionQueue?> GetByIdAsync(Guid id)
        {
            return await _db.SubmissionQueue
                .Include(q => q.Destination)
                .Include(q => q.SubmittedByUser)
                .Include(q => q.ReviewedByTOUser)
                .Include(q => q.ReviewedByOwner)
                .FirstOrDefaultAsync(q => q.Id == id);
        }

        public async Task<(List<SubmissionQueue> Items, int Total)> GetPagedAsync(
            Guid? destinationId, string? status, int page, int pageSize)
        {
            var query = _db.SubmissionQueue
                .Include(q => q.Destination)
                .Include(q => q.SubmittedByUser)
                .AsQueryable();

            if (destinationId.HasValue)
                query = query.Where(q => q.DestinationId == destinationId.Value);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(q => q.Status == status);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(q => q.SubmittedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<List<SubmissionQueue>> GetPendingOwnerReviewAsync(Guid ownerId)
        {
            // Vrati stavke koje čekaju odobrenje PlaceOwnera —
            // tj. status je ApprovedByTO i linked_place_id pripada ovom owneru
            var ownedPlaceIds = await _db.Places
                .Where(p => p.CreatedBy == ownerId)
                .Select(p => p.Id)
                .ToListAsync();

            return await _db.SubmissionQueue
                .Include(q => q.Destination)
                .Include(q => q.SubmittedByUser)
                .Where(q => q.LinkedPlaceId != null
                         && q.Status == "ApprovedByTO"
                         && ownedPlaceIds.Contains(q.LinkedPlaceId!.Value))
                .OrderByDescending(q => q.SubmittedAt)
                .ToListAsync();
        }

        public async Task AddAsync(SubmissionQueue item)
        {
            await _db.SubmissionQueue.AddAsync(item);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}
