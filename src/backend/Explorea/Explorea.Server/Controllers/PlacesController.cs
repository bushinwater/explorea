using Explorea.API.Models;
using Explorea.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/places")]
    public class PlacesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public PlacesController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int? cityId, [FromQuery] int? typeId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = _db.Places
                .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved")
                .Include(p => p.Images)
                .Include(p => p.Type)
                .Include(p => p.City)
                .Include(p => p.Country)
                .AsQueryable();

            if (cityId.HasValue) query = query.Where(p => p.CityId == cityId);
            if (typeId.HasValue) query = query.Where(p => p.TypeId == typeId);

            var places = await query
                .OrderByDescending(p => p.Popularity)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(places.Select(p => MapToCard(p)));
        }

        [HttpGet("{slug}")]
        public async Task<IActionResult> GetBySlug(string slug)
        {
            var place = await _db.Places
                .Where(p => p.Slug == slug && !p.IsDeleted && p.ApprovalStatus == "approved")
                .Include(p => p.Images.OrderBy(i => i.SortOrder))
                .Include(p => p.Type)
                .Include(p => p.City)
                .Include(p => p.Country)
                .Include(p => p.Destination)
                .Include(p => p.WorkingDays).ThenInclude(wd => wd.Intervals)
                .FirstOrDefaultAsync();

            if (place == null) return NotFound();

            var reviews = await _db.Reviews
                .Where(r => r.EntityType == "place" && r.EntityId == place.Id)
                .Include(r => r.User)
                .OrderByDescending(r => r.CreatedAt)
                .Take(20)
                .ToListAsync();

            var totalReviews = await _db.Reviews
                .CountAsync(r => r.EntityType == "place" && r.EntityId == place.Id);

            var similarPlaces = await GetSimilarPlacesAsync(place, 10);

            var previewUrl = place.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.ImageUrl;

            var result = new
            {
                id = place.Id,
                name = place.Name,
                slug = place.Slug,
                type = place.Type == null ? null : new { id = place.Type.Id, name = place.Type.Name },
                avgRating = place.AvgRating,
                address = place.Address,
                distanceKm = (double?)null,
                previewImageUrl = previewUrl,
                isOpen = IsOpenNow(place),
                priceRange = place.PriceRange,
                pricePerNight = place.PricePerNight,
                popularity = place.Popularity,
                country = place.Country == null ? null : new { id = place.Country.Id, name = place.Country.Name, code = place.Country.Code },
                city = place.City == null ? null : new { id = place.City.Id, name = place.City.Name },
                destination = place.Destination == null ? null : new { name = place.Destination.Name, slug = place.Destination.Slug },
                description = place.Description,
                phone = place.Phone,
                email = place.Email,
                websiteUrl = place.WebsiteUrl,
                location = (place.Latitude.HasValue && place.Longitude.HasValue)
                    ? new { lat = place.Latitude!.Value, lng = place.Longitude!.Value }
                    : null,
                images = place.Images.Select(i => new { imageUrl = i.ImageUrl, caption = i.Caption, sortOrder = i.SortOrder }),
                amenities = Array.Empty<object>(),
                extraFilters = string.IsNullOrEmpty(place.ExtraFilters)
                    ? null
                    : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(place.ExtraFilters),
                workingDays = place.WorkingDays.Select(wd => new
                {
                    dayOfWeek = wd.DayOfWeek,
                    isClosed = wd.IsClosed,
                    intervals = wd.Intervals.Select(i => new { opensAt = i.OpensAt.ToString("HH:mm"), closesAt = i.ClosesAt.ToString("HH:mm") }),
                }),
                events = Array.Empty<object>(),
                reviews = reviews.Select(r => new
                {
                    id = r.Id,
                    rating = r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                    ownerReply = r.OwnerReply,
                    ownerReplyAt = r.OwnerReplyAt,
                    user = new
                    {
                        id = r.User.Id,
                        firstName = r.User.FirstName,
                        lastName = r.User.LastName,
                        travelerRank = r.User.TravelerRank,
                        profileImageUrl = r.User.ProfileImageUrl,
                    },
                }),
                similarPlaces,
                totalReviews,
                viewsLast24h = 0,
                hostName = (string?)null,
                hostAvatarUrl = (string?)null,
                checkInTime = (string?)null,
                checkOutTime = (string?)null,
                houseRules = Array.Empty<object>(),
                whatOffers = Array.Empty<string>(),
                openingHours = (string?)null,
            };

            return Ok(result);
        }

        private async Task<IEnumerable<object>> GetSimilarPlacesAsync(Place current, int limit)
        {
            var query = _db.Places
                .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved" && p.Id != current.Id)
                .Include(p => p.Images.OrderBy(i => i.SortOrder))
                .Include(p => p.Type)
                .Include(p => p.City)
                .Include(p => p.Country)
                .AsQueryable();

            if (current.DestinationId.HasValue)
                query = query.Where(p => p.DestinationId == current.DestinationId);
            else if (current.CityId.HasValue)
                query = query.Where(p => p.CityId == current.CityId);

            var items = await query
                .OrderByDescending(p => p.Popularity)
                .Take(limit)
                .ToListAsync();

            return items.Select(p => MapToCard(p));
        }

        private static object MapToCard(Place p)
        {
            var preview = p.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.ImageUrl;
            return new
            {
                id = p.Id,
                name = p.Name,
                slug = p.Slug,
                type = p.Type == null ? null : new { id = p.Type.Id, name = p.Type.Name },
                avgRating = p.AvgRating,
                address = p.Address,
                distanceKm = (double?)null,
                previewImageUrl = preview,
                isOpen = IsOpenNow(p),
                priceRange = p.PriceRange,
                pricePerNight = p.PricePerNight,
                popularity = p.Popularity,
                country = p.Country == null ? null : new { id = p.Country.Id, name = p.Country.Name, code = p.Country.Code },
                city = p.City == null ? null : new { id = p.City.Id, name = p.City.Name },
            };
        }

        private static bool IsOpenNow(Place p)
        {
            if (!p.WorkingDays.Any()) return true;
            var today = (short)DateTime.UtcNow.DayOfWeek;
            var wd = p.WorkingDays.FirstOrDefault(w => w.DayOfWeek == today);
            if (wd == null || wd.IsClosed) return false;
            var now = TimeOnly.FromDateTime(DateTime.UtcNow);
            return wd.Intervals.Any(i => now >= i.OpensAt && now <= i.ClosesAt);
        }
    }
}
