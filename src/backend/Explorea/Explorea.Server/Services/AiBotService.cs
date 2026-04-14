using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class AiBotService : IAiBotService
    {
        public Task ForwardSupportQueryAsync(Guid userId, string query)
        {
            // Ovde kasnije može da ide AI logika ili poziv eksternom servisu.
            return Task.CompletedTask;
        }
    }
}