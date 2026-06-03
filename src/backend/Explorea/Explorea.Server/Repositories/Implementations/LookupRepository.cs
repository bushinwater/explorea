using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

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

        public async Task<List<DestinationType>> GetDestinationTypesAsync()
        {
            return await _db.DestinationTypes.OrderBy(t => t.Name).ToListAsync();
        }

        public async Task<List<FilterDefinition>> GetFilterDefinitionsAsync(string entityType, int typeId)
        {
            return await _db.FilterDefinitions
                .Where(f => f.EntityType == entityType && f.TypeId == typeId)
                .Include(f => f.Options.OrderBy(o => o.SortOrder))
                .OrderBy(f => f.SortOrder)
                .ToListAsync();
        }

        public async Task<(int? RegionId, int? CountryId)> GetRegionByCoordinatesAsync(double lat, double lng)
        {
            var region = await _db.Regions
                .FromSqlRaw(
                    "SELECT * FROM regions WHERE boundary IS NOT NULL AND ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint({1}, {0}), 4326)) LIMIT 1",
                    lat, lng)
                .AsNoTracking()
                .Select(r => new { r.Id, r.CountryId })
                .FirstOrDefaultAsync();

            return (region?.Id, region?.CountryId);
        }
    }
}