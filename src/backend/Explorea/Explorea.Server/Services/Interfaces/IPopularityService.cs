namespace Explorea.Server.Services.Interfaces
{
    public interface IPopularityService
    {
        Task TrackClickAsync(string entityType, Guid entityId, Guid? userId, string? sessionId);
        Task TrackSaveAsync(string entityType, Guid entityId, Guid userId);
    }
}
