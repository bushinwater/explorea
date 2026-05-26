using Explorea.API.Models;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IOwnerChangeNotificationService
    {
        Task NotifyOwnerAsync(
            Guid? ownerId,
            string entityType,
            string entityName,
            User actor,
            IReadOnlyCollection<string> changedFields);
    }
}
