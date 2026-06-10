using Explorea.API.DTOs.Admin.Destination;
using Explorea.Server.Data;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Explorea.Server.Helpers;
using NetTopologySuite.Geometries;
using System.Security.Claims;

namespace Explorea.Server.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/destinations")]
    [Authorize]
    public class AdminDestinationsController : ControllerBase
    {
        private readonly IAdminDestinationService _service;
        private readonly AppDbContext _context;

        public AdminDestinationsController(IAdminDestinationService service, AppDbContext context)
        {
            _service = service;
            _context = context;
        }

        // GET /api/admin/destinations
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search,
            [FromQuery] int? cityId,
            [FromQuery] string? visibility,
            [FromQuery] int? regionId,
            [FromQuery] int? typeId,
            [FromQuery] decimal? minRating,
            [FromQuery] decimal? maxRating,
            [FromQuery] bool? isFeatured,
            [FromQuery] List<string>? extraFilters,
            [FromQuery] string? sortBy = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetAllAsync(
                    search,
                    cityId,
                    visibility,
                    regionId,
                    typeId,
                    minRating,
                    maxRating,
                    isFeatured,
                    page,
                    pageSize,
                    userId,
                    extraFilters,
                    sortBy);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/stats
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var userId = GetCurrentUserId();
                var stats = await _service.GetStatsAsync(userId);
                return Ok(stats);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/countries
        [HttpGet("countries")]
        public async Task<IActionResult> GetCountries()
        {
            var countries = await _service.GetCountriesAsync();
            return Ok(countries);
        }

        // GET /api/admin/destinations/deleted
        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted(
            [FromQuery] string? search,
            [FromQuery] int? cityId,
            [FromQuery] int? regionId,
            [FromQuery] int? typeId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15)
        {
            try
            {
                var userId = GetCurrentUserId();
                var (items, total) = await _service.GetDeletedAsync(
                    search,
                    cityId,
                    regionId,
                    typeId,
                    page,
                    pageSize,
                    userId);
                return Ok(new { total, items });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/regions
        [HttpGet("regions")]
        public async Task<IActionResult> GetRegions()
        {
            try
            {
                var userId = GetCurrentUserId();
                var regions = await _service.GetRegionsAsync(userId);
                return Ok(regions);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/regions-geo
        [HttpGet("regions-geo")]
        public async Task<IActionResult> GetRegionsGeo()
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            bool isSuperAdmin = user?.Role?.Name == RoleNames.SuperAdmin;
            int? managedRegionId = user?.ManagedRegionId;

            var query = _context.Regions.Where(r => r.Boundary != null);
            if (!isSuperAdmin)
            {
                if (!managedRegionId.HasValue)
                    return Ok(new { regions = Array.Empty<object>(), serbiaOutline = (string?)null });
                query = query.Where(r => r.Id == managedRegionId.Value);
            }

            var regions = await query.OrderBy(r => r.Id).ToListAsync();

            var regionDtos = regions.Select(r => new
            {
                id = r.Id,
                name = r.Name,
                boundaryGeoJson = GeometryToGeoJson(r.Boundary!),
            }).ToList();

            string? serbiaOutlineGeoJson = null;
            if (isSuperAdmin && regions.Count > 0)
            {
                var union = regions[0].Boundary!;
                for (int i = 1; i < regions.Count; i++)
                    union = union.Union(regions[i].Boundary!);
                serbiaOutlineGeoJson = GeometryToGeoJson(union);
            }

            return Ok(new { regions = regionDtos, serbiaOutline = serbiaOutlineGeoJson });
        }

        // POST /api/admin/destinations/types
        [HttpPost("types")]
        public async Task<IActionResult> CreateType([FromBody] CreateTypeRequest request)
        {
            try
            {
                var userId = GetCurrentUserId();
                var type = await _service.CreateTypeAsync(request.Name, userId);
                return StatusCode(201, type);
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/destinations/types
        [HttpGet("types")]
        public async Task<IActionResult> GetTypes()
        {
            try
            {
                var userId = GetCurrentUserId();
                var types = await _service.GetTypesAsync(userId);
                return Ok(types);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.GetByIdAsync(id, userId);
                if (result == null) return NotFound();
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/destinations
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AdminCreateDestinationDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _service.CreateAsync(dto, userId);
                return StatusCode(201, created);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // PUT /api/admin/destinations/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateDestinationDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateAsync(id, dto, userId);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // POST /api/admin/destinations/{id}/restore
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var restored = await _service.RestoreAsync(id, userId);
                if (!restored) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // GET /api/admin/destinations/{id}/dependencies
        [HttpGet("{id}/dependencies")]
        public async Task<IActionResult> GetDependencies(
            Guid id,
            [FromQuery] string tab = "events",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var result = await _service.GetDependenciesAsync(id, tab, page, pageSize);
            return Ok(result);
        }

        // DELETE /api/admin/destinations/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteAsync(id, userId);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // DELETE /api/admin/destinations/{id}/cascade
        [HttpDelete("{id}/cascade")]
        public async Task<IActionResult> DeleteCascade(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteCascadeAsync(id, userId);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // POST /api/admin/destinations/{id}/images
        [HttpPost("{id}/images")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> AddImage(Guid id, IFormFile file)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _service.AddImageAsync(id, file, userId);
                return Ok(result);
            }
            catch (KeyNotFoundException) { return NotFound(); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // PUT /api/admin/destinations/{id}/images/{imageId}/preview
        [HttpPut("{id}/images/{imageId}/preview")]
        public async Task<IActionResult> SetPreviewImage(Guid id, Guid imageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var previewUrl = await _service.SetPreviewImageAsync(id, imageId, userId);
                if (previewUrl == null) return NotFound();
                return Ok(new { previewImageUrl = previewUrl });
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // DELETE /api/admin/destinations/{id}/images/{imageId}
        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteImageAsync(id, imageId, userId);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        }

        // GET /api/admin/destinations/{id}/analytics
        [HttpGet("{id}/analytics")]
        public async Task<IActionResult> GetAnalytics(Guid id)
        {
            var now      = DateTimeOffset.UtcNow;
            var monthAgo = now.AddDays(-30);

            // 30-day visits timeline (daily buckets, zero-filled)
            var rawDaily = await _context.PopularityLogs
                .Where(l => l.EntityType == "destination" && l.EntityId == id
                            && l.Source == "click" && l.CreatedAt >= monthAgo)
                .GroupBy(l => new { l.CreatedAt.UtcDateTime.Year, l.CreatedAt.UtcDateTime.Month, l.CreatedAt.UtcDateTime.Day })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Count = g.Count() })
                .ToListAsync();
            var lookup = rawDaily
                .ToDictionary(x => new DateTime(x.Year, x.Month, x.Day), x => x.Count);

            var timeline = new List<object>(31);
            for (var i = 30; i >= 0; i--)
            {
                var d = now.AddDays(-i).UtcDateTime.Date;
                timeline.Add(new
                {
                    date  = d.ToString("yyyy-MM-dd"),
                    value = lookup.GetValueOrDefault(d, 0),
                });
            }

            // Top place / activity / event by clicks on entities belonging to this destination
            var topPlace = await GetTopChildAsync(id, "place");
            var topActivity = await GetTopChildAsync(id, "activity");
            var topEvent = await GetTopChildAsync(id, "event");

            var totalViews = await _context.PopularityLogs
                .CountAsync(l => l.EntityType == "destination" && l.EntityId == id && l.Source == "click");
            var viewsLast30 = await _context.PopularityLogs
                .CountAsync(l => l.EntityType == "destination" && l.EntityId == id && l.Source == "click" && l.CreatedAt >= monthAgo);
            var reviewCount = await _context.Reviews
                .CountAsync(r => r.EntityType == "destination" && r.EntityId == id && !r.IsDeleted && !r.IsHidden);

            // Saved-by users — distinct users who bookmarked this destination
            var savedByUsers = await _context.SavedItems
                .Where(s => s.EntityType == "destination" && s.EntityId == id)
                .Select(s => s.UserId)
                .Distinct()
                .CountAsync();

            // Planner users — distinct users whose TripPlan contains this destination
            var plannerByUsers = await _context.TripPlanItems
                .Where(t => t.EntityType == "destination" && t.EntityId == id)
                .Select(t => t.TripPlan.UserId)
                .Distinct()
                .CountAsync();

            // Most popular planner month for this destination
            var plannerMonthGrouped = await _context.TripPlanItems
                .Where(t => t.EntityType == "destination" && t.EntityId == id)
                .Select(t => new
                {
                    EffectiveDate = t.PlannedAt ?? t.CreatedAt,
                })
                .GroupBy(x => new { x.EffectiveDate.UtcDateTime.Year, x.EffectiveDate.UtcDateTime.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .FirstOrDefaultAsync();

            string? topPlannerMonth = null;
            int topPlannerMonthCount = 0;
            if (plannerMonthGrouped != null)
            {
                topPlannerMonth = $"{plannerMonthGrouped.Year}-{plannerMonthGrouped.Month:D2}";
                topPlannerMonthCount = plannerMonthGrouped.Count;
            }

            return Ok(new
            {
                totalViews,
                viewsLast30,
                reviewCount,
                viewsTimeline = timeline,
                topPlace,
                topActivity,
                topEvent,
                savedByUsers,
                plannerByUsers,
                topPlannerMonth,
                topPlannerMonthCount,
            });
        }

        private async Task<object?> GetTopChildAsync(Guid destinationId, string entityType)
        {
            // Get all entity IDs of given type that belong to this destination.
            IQueryable<Guid> entityIds = entityType switch
            {
                "place" => _context.Places
                    .IgnoreQueryFilters()
                    .Where(p => !p.IsDeleted && p.DestinationId == destinationId)
                    .Select(p => p.Id),
                "activity" => _context.Activities
                    .IgnoreQueryFilters()
                    .Where(a => !a.IsDeleted && a.DestinationId == destinationId)
                    .Select(a => a.Id),
                "event" => _context.Events
                    .IgnoreQueryFilters()
                    .Where(e => !e.IsDeleted && e.DestinationId == destinationId)
                    .Select(e => e.Id),
                _ => Enumerable.Empty<Guid>().AsQueryable(),
            };
            var idList = await entityIds.ToListAsync();
            if (idList.Count == 0) return null;

            // Pick the one with most clicks.
            var topGroup = await _context.PopularityLogs
                .Where(l => l.EntityType == entityType && idList.Contains(l.EntityId) && l.Source == "click")
                .GroupBy(l => l.EntityId)
                .Select(g => new { Id = g.Key, Views = g.Count() })
                .OrderByDescending(g => g.Views)
                .FirstOrDefaultAsync();

            // Fall back to any entity (with 0 views) if no clicks exist.
            Guid targetId; int views;
            if (topGroup != null) { targetId = topGroup.Id; views = topGroup.Views; }
            else                  { targetId = idList[0];   views = 0; }

            return entityType switch
            {
                "place" => await _context.Places
                    .IgnoreQueryFilters()
                    .Where(p => p.Id == targetId)
                    .Select(p => new { id = p.Id, name = p.Name, slug = p.Slug, views, entityType = "place" })
                    .FirstOrDefaultAsync(),
                "activity" => await _context.Activities
                    .IgnoreQueryFilters()
                    .Where(a => a.Id == targetId)
                    .Select(a => new { id = a.Id, name = a.Name, slug = a.Slug, views, entityType = "activity" })
                    .FirstOrDefaultAsync(),
                "event" => await _context.Events
                    .IgnoreQueryFilters()
                    .Where(e => e.Id == targetId)
                    .Select(e => new { id = e.Id, name = e.Name, slug = e.Slug, views, entityType = "event" })
                    .FirstOrDefaultAsync(),
                _ => null,
            };
        }

        [HttpGet("{id}/reviews")]
        public async Task<IActionResult> GetReviews(Guid id)
        {
            var reviews = await _context.Reviews
                .Where(r => r.EntityType == "destination" && r.EntityId == id)
                .Include(r => r.User)
                .Include(r => r.Images)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .Select(r => new
                {
                    id = r.Id,
                    authorName = r.User.FirstName + " " + r.User.LastName,
                    authorAvatarUrl = r.User.ProfileImageUrl,
                    rating = (int)r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                    imageUrls = r.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).ToList(),
                })
                .ToListAsync();
            return Ok(reviews);
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(claim!);
        }

        private static string GeometryToGeoJson(Geometry geom)
        {
            if (geom is MultiPolygon mp)
            {
                var polys = string.Join(",", mp.Geometries.Cast<Polygon>().Select(PolygonToGeoJson));
                return $"{{\"type\":\"MultiPolygon\",\"coordinates\":[{polys}]}}";
            }
            if (geom is Polygon poly)
                return $"{{\"type\":\"Polygon\",\"coordinates\":{PolygonToGeoJson(poly)}}}";
            return "null";
        }

        private static string PolygonToGeoJson(Polygon poly)
        {
            var rings = new System.Collections.Generic.List<string> { RingToGeoJson(poly.ExteriorRing) };
            rings.AddRange(poly.InteriorRings.Select(RingToGeoJson));
            return $"[{string.Join(",", rings)}]";
        }

        private static string RingToGeoJson(LineString ring) =>
            $"[{string.Join(",", ring.Coordinates.Select(c => $"[{c.X.ToString(System.Globalization.CultureInfo.InvariantCulture)},{c.Y.ToString(System.Globalization.CultureInfo.InvariantCulture)}]"))}]";

        // PATCH /api/admin/destinations/regions/{id}/boundary
        [HttpPatch("regions/{id:int}/boundary")]
        public async Task<IActionResult> UpdateRegionBoundary(int id, [FromBody] UpdateBoundaryRequest request)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user?.Role?.Name != RoleNames.SuperAdmin)
                return StatusCode(403, new { message = "Samo superadmin može da menja granice regiona." });

            var region = await _context.Regions.FirstOrDefaultAsync(r => r.Id == id);
            if (region == null)
                return NotFound(new { message = "Region nije pronađen." });

            if (string.IsNullOrWhiteSpace(request.BoundaryGeoJson))
            {
                region.Boundary = null;
            }
            else
            {
                var geom = GeoJsonToGeometry(request.BoundaryGeoJson);
                if (geom == null)
                    return BadRequest(new { message = "Nevažeći GeoJSON format. Očekuje se Polygon ili MultiPolygon." });
                region.Boundary = geom;
            }

            region.UpdatedAt = DateTimeOffset.UtcNow;
            region.UpdatedBy = userId;
            await _context.SaveChangesAsync();

            return Ok(new { id = region.Id, name = region.Name, hasBoundary = region.Boundary != null });
        }

        private static readonly GeometryFactory _geoFactory = new GeometryFactory(new PrecisionModel(), 4326);

        private static Geometry? GeoJsonToGeometry(string geoJson)
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(geoJson);
                var root = doc.RootElement;
                var type = root.GetProperty("type").GetString();

                if (type == "Polygon")
                {
                    var coords = root.GetProperty("coordinates");
                    var rings = ParseRings(coords);
                    return _geoFactory.CreatePolygon(rings[0], rings.Skip(1).ToArray());
                }

                if (type == "MultiPolygon")
                {
                    var coords = root.GetProperty("coordinates");
                    var polygons = coords.EnumerateArray().Select(polyCoords =>
                    {
                        var rings = ParseRings(polyCoords);
                        return _geoFactory.CreatePolygon(rings[0], rings.Skip(1).ToArray());
                    }).ToArray();
                    return _geoFactory.CreateMultiPolygon(polygons);
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        private static LinearRing[] ParseRings(System.Text.Json.JsonElement ringArray)
        {
            return ringArray.EnumerateArray().Select(ring =>
            {
                var coords = ring.EnumerateArray()
                    .Select(c => new Coordinate(c[0].GetDouble(), c[1].GetDouble()))
                    .ToArray();
                return _geoFactory.CreateLinearRing(coords);
            }).ToArray();
        }
    }

    public record CreateTypeRequest(string Name);
    public record UpdateBoundaryRequest(string? BoundaryGeoJson);
}
