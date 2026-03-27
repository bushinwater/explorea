using Explorea.API.Models;

namespace Explorea.Server.Repositories.Interfaces
{
    public interface ILookupRepository
    {
        Task<List<City>> GetCitiesAsync(int? regionId);
        Task<List<Region>> GetRegionsAsync();
        Task<List<PlaceType>> GetPlaceTypesAsync();
        Task<List<EventType>> GetEventTypesAsync();
        Task<List<ActivityCategory>> GetActivityCategoriesAsync();
        Task<List<Season>> GetSeasonsAsync();
        Task<List<InterestTag>> GetInterestTagsAsync();
    }
}