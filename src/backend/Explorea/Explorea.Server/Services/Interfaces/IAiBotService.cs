namespace Explorea.Server.Services.Interfaces
{
    public interface IAiBotService
    {
        Task ForwardSupportQueryAsync(Guid userId, string query);
    }
}