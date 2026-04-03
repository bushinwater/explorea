using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Repositories.Implementations
{
    public class LookupRepository : ILookupRepository
    {
        private readonly AppDbContext _db;

        public LookupRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<City>> GetCitiesAsync(int? regionId)
        {
            var query = _db.Cities.AsQueryable();
            if (regionId.HasValue)
                query = query.Where(c => c.RegionId == regionId);
            return await query.OrderBy(c => c.Name).ToListAsync();
        }

        public async Task<List<Region>> GetRegionsAsync()
        {
            return await _db.Regions.OrderBy(r => r.Name).ToListAsync();
        }

        public async Task<List<PlaceType>> GetPlaceTypesAsync()
        {
            return await _db.PlaceTypes.OrderBy(t => t.Name).ToListAsync();
        }

        public async Task<List<EventType>> GetEventTypesAsync()
        {
            return await _db.EventTypes.OrderBy(t => t.Name).ToListAsync();
        }

        public async Task<List<ActivityCategory>> GetActivityCategoriesAsync()
        {
            return await _db.ActivityCategories.OrderBy(c => c.Name).ToListAsync();
        }

        public async Task<List<Season>> GetSeasonsAsync()
        {
            return await _db.Seasons.ToListAsync();
        }

        public async Task<List<InterestTag>> GetInterestTagsAsync()
        {
            return await _db.InterestTags.OrderBy(t => t.Name).ToListAsync();
        }

        public async Task<List<Country>> GetCountriesAsync()
        {
            return await _db.Countries.OrderBy(c => c.Name).ToListAsync();
        }
    }
}