using Explorea.API.DTOs.Admin.Destination;

namespace Explorea.Server.Services.Admin.Interfaces
{
    public interface IAdminDestinationService
    {
        Task<(List<AdminDestinationListDto> Items, int Total)> GetAllAsync(
            string? search,
            int? cityId,
            string? visibility,
            int? regionId,
            int? typeId,
            decimal? minRating,
            decimal? maxRating,
            bool? isFeatured,
            int page,
            int pageSize,
            Guid currentUserId,
            List<string>? extraFilters = null);

        Task<AdminDestinationStatsDto> GetStatsAsync(Guid currentUserId);

        Task<List<AdminDestinationLookupDto>> GetRegionsAsync(Guid currentUserId);

        Task<List<AdminCountryLookupDto>> GetCountriesAsync();

        Task<List<AdminDestinationLookupDto>> GetTypesAsync(Guid currentUserId);

        Task<AdminDestinationListDto?> GetByIdAsync(Guid id, Guid currentUserId);

        Task<AdminDestinationListDto> CreateAsync(AdminCreateDestinationDto dto, Guid createdBy);

        Task<AdminDestinationListDto?> UpdateAsync(Guid id, AdminUpdateDestinationDto dto, Guid updatedBy);

        Task<bool> DeleteAsync(Guid id, Guid currentUserId);

        Task<AdminDestinationImageDto> AddImageAsync(Guid destinationId, IFormFile file, Guid userId);

        Task<bool> DeleteImageAsync(Guid destinationId, Guid imageId, Guid userId);

        Task<string?> SetPreviewImageAsync(Guid destinationId, Guid imageId, Guid userId);

        Task<AdminDestinationLookupDto> CreateTypeAsync(string name, Guid userId);
    }
}
