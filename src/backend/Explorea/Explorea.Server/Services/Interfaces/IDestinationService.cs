using Explorea.API.DTOs.Destination;

namespace Explorea.Server.Services.Interfaces
{
    public interface IDestinationService
    {
        Task<IEnumerable<DestinationCardDto>> GetAllAsync();
        Task<DestinationDetailDto?> GetBySlugAsync(string slug);
    }
}