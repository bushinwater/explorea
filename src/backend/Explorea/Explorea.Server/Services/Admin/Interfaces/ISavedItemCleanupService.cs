namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface ISavedItemCleanupService
    {
        Task RemoveDeletedEntityFromSavedItemsAsync(string entityType, Guid entityId, string entityName);
    }
}
