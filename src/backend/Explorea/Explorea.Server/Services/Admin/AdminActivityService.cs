using Explorea.API.DTOs.Admin.Activity;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Admin.Interfaces;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
  public class AdminActivityService : IAdminActivityService
  {
    private readonly IAdminActivityRepository _repository;
    private readonly AppDbContext _context;
    private readonly IUserRepository _userRepo;
    private readonly ISavedItemCleanupService _savedItemCleanup;

    public AdminActivityService(
      IAdminActivityRepository repository,
      AppDbContext context,
      IUserRepository userRepo,
      ISavedItemCleanupService savedItemCleanup)
    {
      _repository = repository;
      _context = context;
      _userRepo = userRepo;
      _savedItemCleanup = savedItemCleanup;
    }

    public async Task<(List<AdminActivityListDto> Items, int Total)> GetAllAsync(AdminActivityListQueryDto query, Guid currentUserId)
    {
      ValidatePagination(query.Page, query.PageSize);

      var activitiesQuery = _repository.Query();

      var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
      if (user?.Role.Name == RoleNames.TouristOrganization && user.ManagedRegionId.HasValue)
      {
        var regionId = user.ManagedRegionId.Value;
        activitiesQuery = activitiesQuery.Where(a => a.City != null && a.City.RegionId == regionId);
      }

      if (query.Ids?.Count > 0)
      {
        activitiesQuery = activitiesQuery.Where(a => query.Ids.Contains(a.Id));
      }
      else if (!string.IsNullOrWhiteSpace(query.Search))
      {
        var search = query.Search.Trim().ToLower();
        activitiesQuery = activitiesQuery.Where(a =>
          a.Name.ToLower().Contains(search)
        );
      }

      if (query.RegionId.HasValue)
      {
        activitiesQuery = activitiesQuery.Where(a =>
          a.City != null &&
          a.City.RegionId == query.RegionId.Value
        );
      }

      if (query.CityId.HasValue)
      {
        activitiesQuery = activitiesQuery.Where(a =>
          a.CityId == query.CityId.Value
        );
      }

      if (query.CategoryId.HasValue)
      {
        activitiesQuery = activitiesQuery.Where(a =>
          a.CategoryId == query.CategoryId.Value
        );
      }

      if (!string.IsNullOrWhiteSpace(query.DifficultyLevel))
      {
        var difficulty = query.DifficultyLevel.Trim().ToLowerInvariant();
        activitiesQuery = activitiesQuery.Where(a =>
          a.DifficultyLevel != null &&
          a.DifficultyLevel.ToLower() == difficulty
        );
      }

      if (!string.IsNullOrWhiteSpace(query.Duration))
      {
        var duration = query.Duration.Trim().ToLowerInvariant();

        activitiesQuery = duration switch
        {
          "up_to_2h" => activitiesQuery.Where(a =>
            a.DurationMinutes.HasValue &&
            a.DurationMinutes.Value <= 120
          ),
          "from_2h_to_6h" => activitiesQuery.Where(a =>
            a.DurationMinutes.HasValue &&
            a.DurationMinutes.Value > 120 &&
            a.DurationMinutes.Value <= 360
          ),
          "multi_day" => activitiesQuery.Where(a =>
            a.DurationMinutes.HasValue &&
            a.DurationMinutes.Value > 360
          ),
          _ => throw new ArgumentException("Unsupported duration filter value.")
        };
      }

      if (!string.IsNullOrWhiteSpace(query.Status))
      {
        var status = query.Status.Trim().ToLowerInvariant();

        activitiesQuery = status switch
        {
          "active"   => activitiesQuery.Where(a => !a.IsDeleted),
          "inactive" => activitiesQuery.Where(a => a.IsDeleted),
          _ => throw new ArgumentException("Unsupported status filter value.")
        };
      }

      if (!string.IsNullOrWhiteSpace(query.Popularity))
      {
        var popularity = query.Popularity.Trim().ToLowerInvariant();

        activitiesQuery = popularity switch
        {
          "low"    => activitiesQuery.Where(a => a.Popularity < 300),
          "medium" => activitiesQuery.Where(a => a.Popularity >= 300 && a.Popularity < 700),
          "high"   => activitiesQuery.Where(a => a.Popularity >= 700),
          _ => throw new ArgumentException("Unsupported popularity filter value.")
        };
      }

      if (query.MinAvgRating.HasValue)
      {
        if (query.MinAvgRating < 0 || query.MinAvgRating > 5)
          throw new ArithmeticException("MinAvgRating must be between 0 and 5");

        activitiesQuery = activitiesQuery.Where(a => a.AvgRating >= query.MinAvgRating.Value);
      }

      if (query.IsFeatured.HasValue)
        activitiesQuery = activitiesQuery.Where(a => a.IsFeatured == query.IsFeatured.Value);

      if (query.IsFree == true)
        activitiesQuery = activitiesQuery.Where(a => a.Price == null);

      if (query.ExtraFilters?.Count > 0)
      {
        var efDict = ParseExtraFilters(query.ExtraFilters);
        foreach (var (key, value) in efDict)
        {
          var snippet = $"{{\"{key}\": {value.ToLower()}}}";
          activitiesQuery = activitiesQuery.Where(a => a.ExtraData != null && EF.Functions.JsonContains(a.ExtraData, snippet));
        }
      }

      activitiesQuery = activitiesQuery.OrderByDescending(a => a.CreatedAt);

      var total = await activitiesQuery.CountAsync();

      var items = await activitiesQuery
        .Skip((query.Page - 1) * query.PageSize)
        .Take(query.PageSize)
        .Select(a => new AdminActivityListDto
        {
          Id = a.Id,
          Name = a.Name,
          Slug = a.Slug,
          Description = a.Description,

          CategoryId = a.CategoryId,
          Category   = a.Category.Name,

          CityId = a.CityId,
          City   = a.City != null ? a.City.Name : null,

          RegionId = a.City != null ? a.City.RegionId : null,
          Region   = a.City != null && a.City.Region != null ? a.City.Region.Name : null,

          DestinationId = a.DestinationId,
          Destination   = a.Destination != null ? a.Destination.Name : null,

          Price           = a.Price,
          DurationMinutes = a.DurationMinutes,
          DurationGroup   = GetDurationGroup(a.DurationMinutes),

          DifficultyLevel = a.DifficultyLevel,
          DistanceKm      = a.DistanceKm,
          StartPoint      = a.StartPoint,

          AvgRating  = a.AvgRating,
          Popularity = a.Popularity,

          IsFeatured = a.IsFeatured,
          IsActive   = !a.IsDeleted,

          PreviewImageUrl = a.Images
            .OrderBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .FirstOrDefault(),

          CreatedAt = a.CreatedAt,
          UpdatedAt = a.UpdatedAt,
          DeletedAt = a.DeletedAt
        })
        .ToListAsync();

      return (items, total);
    }

    public async Task<(List<AdminActivityListDto> Items, int Total)> GetDeletedAsync(AdminActivityListQueryDto query, Guid currentUserId)
    {
      ValidatePagination(query.Page, query.PageSize);

      var activitiesQuery = _repository.Query()
        .Where(a => a.IsDeleted);

      var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
      if (user?.Role.Name == RoleNames.TouristOrganization && user.ManagedRegionId.HasValue)
      {
        var regionId = user.ManagedRegionId.Value;
        activitiesQuery = activitiesQuery.Where(a => a.City != null && a.City.RegionId == regionId);
      }

      if (!string.IsNullOrWhiteSpace(query.Search))
      {
        var search = query.Search.Trim().ToLower();
        activitiesQuery = activitiesQuery.Where(a => a.Name.ToLower().Contains(search));
      }

      if (query.RegionId.HasValue)
        activitiesQuery = activitiesQuery.Where(a => a.City != null && a.City.RegionId == query.RegionId.Value);

      if (query.CityId.HasValue)
        activitiesQuery = activitiesQuery.Where(a => a.CityId == query.CityId.Value);

      if (query.CategoryId.HasValue)
        activitiesQuery = activitiesQuery.Where(a => a.CategoryId == query.CategoryId.Value);

      var total = await activitiesQuery.CountAsync();

      var items = await activitiesQuery
        .OrderByDescending(a => a.DeletedAt ?? a.UpdatedAt)
        .Skip((query.Page - 1) * query.PageSize)
        .Take(query.PageSize)
        .Select(a => new AdminActivityListDto
        {
          Id = a.Id,
          Name = a.Name,
          Slug = a.Slug,
          Description = a.Description,
          CategoryId = a.CategoryId,
          Category = a.Category.Name,
          CityId = a.CityId,
          City = a.City != null ? a.City.Name : null,
          RegionId = a.City != null ? a.City.RegionId : null,
          Region = a.City != null && a.City.Region != null ? a.City.Region.Name : null,
          DestinationId = a.DestinationId,
          Destination = a.Destination != null ? a.Destination.Name : null,
          Price = a.Price,
          DurationMinutes = a.DurationMinutes,
          DurationGroup = GetDurationGroup(a.DurationMinutes),
          DifficultyLevel = a.DifficultyLevel,
          DistanceKm = a.DistanceKm,
          StartPoint = a.StartPoint,
          AvgRating = a.AvgRating,
          Popularity = a.Popularity,
          IsFeatured = a.IsFeatured,
          IsActive = false,
          PreviewImageUrl = a.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
          CreatedAt = a.CreatedAt,
          UpdatedAt = a.UpdatedAt,
          DeletedAt = a.DeletedAt
        })
        .ToListAsync();

      return (items, total);
    }

    public async Task<AdminActivityDetailsDto?> GetByIdAsync(Guid id, Guid currentUserId)
    {
      var activity = await _repository.GetByIdAsync(id);

      if (activity == null) return null;

      var reviews = await _context.Reviews
        .AsNoTracking()
        .Include(r => r.User)
        .Where(r => r.EntityType == "activity" && r.EntityId == id && !r.IsDeleted && !r.IsHidden)
        .OrderByDescending(r => r.CreatedAt)
        .Take(10)
        .Select(r => new ActivityReviewDto
        {
          AuthorName      = r.User.FirstName + " " + r.User.LastName,
          AuthorAvatarUrl = r.User.ProfileImageUrl,
          Rating          = r.Rating,
          Comment         = r.Comment,
          CreatedAt       = r.CreatedAt,
        })
        .ToListAsync();

      return new AdminActivityDetailsDto
      {
        Id = activity.Id,

        CityId        = activity.CityId,
        CityName      = activity.City?.Name,
        DestinationId = activity.DestinationId,
        PlaceId       = activity.PlaceId,

        CategoryId   = activity.CategoryId,
        CategoryName = activity.Category.Name,
        SeasonId     = activity.SeasonId,
        SeasonName   = activity.Season?.Name,
        CountryId    = activity.CountryId,

        RegionId   = activity.City?.RegionId,
        RegionName = activity.City?.Region?.Name,

        Name        = activity.Name,
        Slug        = activity.Slug,
        Description = activity.Description,

        Price           = activity.Price,
        DurationMinutes = activity.DurationMinutes,

        DifficultyLevel = activity.DifficultyLevel,
        DistanceKm      = activity.DistanceKm,
        StartPoint      = activity.StartPoint,

        AvgRating  = activity.AvgRating,
        Popularity = activity.Popularity,

        ExtraData = activity.ExtraData,

        Latitude  = activity.Latitude,
        Longitude = activity.Longitude,

        IsFeatured = activity.IsFeatured,
        IsActive   = !activity.IsDeleted,

        OrganizerWebsite = activity.OrganizerWebsite,

        PreviewImageUrl = activity.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault(),

        Images = activity.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => new ActivityImageItemDto { Id = i.Id, Url = i.ImageUrl, SortOrder = i.SortOrder })
          .ToList(),

        Inclusions = activity.Inclusions
          .Select(inc => inc.Item)
          .ToList(),

        Reviews = reviews,

        CreatedAt = activity.CreatedAt,
        UpdatedAt = activity.UpdatedAt
      };
    }

    public async Task<AdminActivityStatsDto> GetStatsAsync(Guid currentUserId)
    {
      return await _repository.GetStatsAsync();
    }

    public async Task<AdminActivityFilterOptionsDto> GetFilterOptionsAsync(Guid currentUserId)
    {
      var baseQuery = _repository.Query();

      AdminActivityFilterOptionsDto.RegionItem? managedRegion = null;
      var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
      if (user?.Role.Name == RoleNames.TouristOrganization && user.ManagedRegionId.HasValue)
      {
        var regionId = user.ManagedRegionId.Value;
        baseQuery = baseQuery.Where(a => a.City != null && a.City.RegionId == regionId);
        managedRegion = new AdminActivityFilterOptionsDto.RegionItem(
          user.ManagedRegionId.Value,
          user.ManagedRegion?.Name ?? "");
      }

      var difficulties = await baseQuery
        .Where(a => a.DifficultyLevel != null)
        .Select(a => a.DifficultyLevel!)
        .Distinct()
        .OrderBy(d => d)
        .ToListAsync();

      var categoryData = await baseQuery
        .Select(a => new { a.CategoryId, CategoryName = a.Category.Name })
        .Distinct()
        .OrderBy(c => c.CategoryName)
        .ToListAsync();

      return new AdminActivityFilterOptionsDto
      {
        Difficulties = difficulties,
        Categories = categoryData.Select(c => new AdminActivityFilterOptionsDto.CategoryItem(c.CategoryId, c.CategoryName)).ToList(),
        ManagedRegion = managedRegion,
      };
    }

    public async Task<AdminActivityDetailsDto> CreateAsync(AdminCreateActivityDto dto, Guid createdBy)
    {
      ValidateCreateDto(dto);

      var now = DateTimeOffset.UtcNow;

      var activity = new API.Models.Activity
      {
        Id = Guid.NewGuid(),

        CityId        = dto.CityId,
        DestinationId = dto.DestinationId,
        PlaceId       = dto.PlaceId,
        CategoryId    = dto.CategoryId,
        SeasonId      = dto.SeasonId,
        CountryId     = dto.CountryId,

        Name        = dto.Name.Trim(),
        Slug        = dto.Slug.Trim(),
        Description = dto.Description?.Trim(),

        Price           = dto.Price,
        DurationMinutes = dto.DurationMinutes,

        DifficultyLevel = dto.DifficultyLevel?.Trim(),
        DistanceKm      = dto.DistanceKm,
        StartPoint      = dto.StartPoint?.Trim(),

        ExtraData = dto.ExtraData,

        Latitude  = dto.Latitude,
        Longitude = dto.Longitude,
        Location  = BuildLocation(dto.Latitude, dto.Longitude),

        Popularity = dto.Popularity,
        IsFeatured = dto.IsFeatured,
        IsDeleted  = !dto.IsActive,
        DeletedAt  = dto.IsActive ? null : now,

        OrganizerWebsite = dto.OrganizerWebsite?.Trim(),

        CreatedAt = now,
        UpdatedAt = now,
        CreatedBy = createdBy,
        UpdatedBy = createdBy
      };

      await _repository.AddAsync(activity);
      await _repository.SaveChangesAsync();

      if (dto.Inclusions?.Count > 0)
      {
        var inclusions = dto.Inclusions
          .Where(s => !string.IsNullOrWhiteSpace(s))
          .Select(s => new API.Models.ActivityInclusion
          {
            Id         = Guid.NewGuid(),
            ActivityId = activity.Id,
            Item       = s.Trim(),
            CreatedAt  = now,
            CreatedBy  = createdBy,
          });
        await _context.ActivityInclusions.AddRangeAsync(inclusions);
        await _context.SaveChangesAsync();
      }

      return (await GetByIdAsync(activity.Id, createdBy))!;
    }

    public async Task<AdminActivityDetailsDto?> UpdateAsync(Guid id, AdminUpdateActivityDto dto, Guid updatedBy)
    {
      ValidateUpdateDto(dto);

      var activity = await _repository.GetByIdAsync(id);

      if (activity == null) return null;

      var now = DateTimeOffset.UtcNow;

      if (dto.CityId.HasValue)        activity.CityId        = dto.CityId.Value;
      if (dto.DestinationId.HasValue) activity.DestinationId = dto.DestinationId.Value;
      if (dto.PlaceId.HasValue)       activity.PlaceId       = dto.PlaceId.Value;
      if (dto.CategoryId.HasValue)    activity.CategoryId    = dto.CategoryId.Value;
      if (dto.SeasonId.HasValue)      activity.SeasonId      = dto.SeasonId.Value;
      if (dto.CountryId.HasValue)     activity.CountryId     = dto.CountryId.Value;

      if (!string.IsNullOrWhiteSpace(dto.Name)) activity.Name = dto.Name.Trim();
      if (!string.IsNullOrWhiteSpace(dto.Slug)) activity.Slug = dto.Slug.Trim();
      if (dto.Description != null)              activity.Description = dto.Description.Trim();

      if (dto.Price.HasValue)           activity.Price           = dto.Price.Value;
      if (dto.DurationMinutes.HasValue) activity.DurationMinutes = dto.DurationMinutes.Value;
      if (dto.DifficultyLevel != null)  activity.DifficultyLevel = dto.DifficultyLevel.Trim();
      if (dto.DistanceKm.HasValue)      activity.DistanceKm      = dto.DistanceKm.Value;
      if (dto.StartPoint != null)       activity.StartPoint      = dto.StartPoint.Trim();
      if (dto.ExtraData != null)        activity.ExtraData       = dto.ExtraData;

      if (dto.Latitude.HasValue || dto.Longitude.HasValue)
      {
        activity.Latitude  = dto.Latitude;
        activity.Longitude = dto.Longitude;
        activity.Location  = BuildLocation(dto.Latitude, dto.Longitude);
      }

      if (dto.Popularity.HasValue) activity.Popularity = dto.Popularity.Value;
      if (dto.IsFeatured.HasValue) activity.IsFeatured = dto.IsFeatured.Value;

      if (dto.IsActive.HasValue)
      {
        activity.IsDeleted = !dto.IsActive.Value;
        activity.DeletedAt = dto.IsActive.Value ? null : now;
      }

      if (dto.OrganizerWebsite != null) activity.OrganizerWebsite = dto.OrganizerWebsite.Trim();

      activity.UpdatedAt = now;
      activity.UpdatedBy = updatedBy;

      _repository.Update(activity);
      await _repository.SaveChangesAsync();

      return await GetByIdAsync(activity.Id, updatedBy);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
    {
      var activity = await _repository.GetByIdAsync(id);

      if (activity == null) return false;
      if (activity.IsDeleted) return true;

      activity.UpdatedAt = DateTimeOffset.UtcNow;
      activity.UpdatedBy = currentUserId;
      _repository.Delete(activity);
      await _repository.SaveChangesAsync();
      await _savedItemCleanup.RemoveDeletedEntityFromSavedItemsAsync(
        "activity",
        activity.Id,
        activity.Name);

      return true;
    }

    private static void ValidateCreateDto(AdminCreateActivityDto dto)
    {
      if (string.IsNullOrWhiteSpace(dto.Name))  throw new ArgumentException("Name is required");
      if (string.IsNullOrWhiteSpace(dto.Slug))  throw new ArgumentException("Slug is required");
      if (dto.CategoryId <= 0)                  throw new ArgumentException("CategoryId is required");
      if (dto.Price.HasValue && dto.Price.Value < 0)                          throw new ArgumentException("Price must be >= 0");
      if (dto.DurationMinutes.HasValue && dto.DurationMinutes.Value < 0)      throw new ArgumentException("DurationMinutes must be > 0");
      if (dto.Latitude.HasValue ^ dto.Longitude.HasValue)                     throw new ArgumentException("Latitude and Longitude must be provided together");
      if (dto.Latitude is < -90 or > 90)                                      throw new ArgumentException("Latitude must be between -90 and 90");
      if (dto.Longitude is < -180 or > 180)                                   throw new ArgumentException("Longitude must be between -180 and 180");
    }

    private static void ValidateUpdateDto(AdminUpdateActivityDto dto)
    {
      if (dto.Name != null && string.IsNullOrWhiteSpace(dto.Name))      throw new ArgumentException("Name cannot be empty.");
      if (dto.Slug != null && string.IsNullOrWhiteSpace(dto.Slug))      throw new ArgumentException("Slug cannot be empty");
      if (dto.CategoryId.HasValue && dto.CategoryId.Value <= 0)         throw new ArgumentException("CategoryId must be > 0");
      if (dto.Price.HasValue && dto.Price.Value < 0)                    throw new ArgumentException("Price must be >= 0");
      if (dto.DurationMinutes.HasValue && dto.DurationMinutes.Value <= 0) throw new ArgumentException("DurationMinutes must be > 0");
      if (dto.Latitude.HasValue ^ dto.Longitude.HasValue)               throw new ArgumentException("Latitude and Longitude must be provided together");
      if (dto.Latitude is < -90 or > 90)                                throw new ArgumentException("Latitude must be between -90 and 90");
      if (dto.Longitude is < -180 or > 180)                             throw new ArgumentException("Longitude must be between -180 and 180");
      if (dto.Popularity.HasValue && dto.Popularity.Value < 0)          throw new ArgumentException("Popularity must be >= 0");
    }

    private static Point? BuildLocation(double? latitude, double? longitude)
    {
      if (!latitude.HasValue || !longitude.HasValue) return null;
      return new Point(longitude.Value, latitude.Value) { SRID = 4326 };
    }

    private static void ValidatePagination(int page, int pageSize)
    {
      if (page < 1)                     throw new ArgumentException("Page must be >= 1.");
      if (pageSize < 1 || pageSize > 500) throw new ArgumentException("PageSize must be between 1 and 500.");
    }

    private static string? GetDurationGroup(int? durationMinutes)
    {
      if (!durationMinutes.HasValue)         return null;
      if (durationMinutes.Value <= 120)      return "up_to_2h";
      if (durationMinutes.Value <= 360)      return "from_2h_to_6h";
      return "multi_day";
    }

    private static Dictionary<string, string> ParseExtraFilters(List<string>? raw)
    {
      if (raw == null || raw.Count == 0) return new Dictionary<string, string>();
      var result = new Dictionary<string, string>();
      foreach (var item in raw)
      {
        var idx = item.IndexOf(':');
        if (idx > 0) result[item[..idx]] = item[(idx + 1)..];
      }
      return result;
    }
  }
}
