using System.Diagnostics;
using Explorea.API.DTOs.Admin.Activity;
using Explorea.Server.Repositories.Admin.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
  public class AdminActivityService : IAdminActivityService
  {
    private readonly IAdminActivityRepository _repository;

    public AdminActivityService(IAdminActivityRepository repository)
    {
      _repository = repository;
    }
    public async Task<(List<AdminActivityListDto> Items, int Total)> GetAllAsync(AdminActivityListQueryDto query, Guid currentUserId)
    {
      ValidatePagination(query.Page, query.PageSize);

      var activitiesQuery = _repository.Query();

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
          "active" => activitiesQuery.Where(a => !a.IsDeleted),
          "inactive" => activitiesQuery.Where(a => a.IsDeleted),
          _ => throw new ArgumentException("Unsupported status filter value.")
        };
      }

      if (!string.IsNullOrWhiteSpace(query.Popularity))
      {
        var popularity = query.Popularity.Trim().ToLowerInvariant();
      
        activitiesQuery = popularity switch
        {
          "low" => activitiesQuery.Where(a =>
            a.Popularity < 300
          ),
          "medium" => activitiesQuery.Where(a =>
            a.Popularity >= 300 &&
            a.Popularity < 700
          ),
          "high" => activitiesQuery.Where(a =>
            a.Popularity >= 700
          ),
          _ => throw new ArgumentException("Unsupported popularity filter value.")
        };
      }

      if (query.MinAvgRating.HasValue)
      {
        if(query.MinAvgRating < 0 || query.MinAvgRating > 5)
        {
          throw new ArithmeticException("MinAvgRating must be between 0 and 5");
        }
        activitiesQuery = activitiesQuery.Where(a =>
          a.AvgRating >= query.MinAvgRating.Value
        );
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
          IsActive = !a.IsDeleted,

          PreviewImageUrl = a.Images
            .OrderBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .FirstOrDefault(),

          CreatedAt = a.CreatedAt,
          UpdatedAt = a.UpdatedAt
        })
        .ToListAsync();

        return (items, total);
    }
    public async Task<AdminActivityDetailsDto> CreateAsync(AdminCreateActivityDto dto, Guid createdBy)
    {
      ValidateCreateDto(dto);

      var now = DateTimeOffset.UtcNow;
      
      var activity = new API.Models.Activity
      {
        Id = Guid.NewGuid(),

        CityId = dto.CityId,
        DestinationId = dto.DestinationId,
        PlaceId = dto.PlaceId,
        CategoryId = dto.CategoryId,
        SeasonId = dto.SeasonId,
        CountryId = dto.CountryId,

        Name = dto.Name.Trim(),
        Slug = dto.Slug.Trim(),
        Description = dto.Description?.Trim(),

        Price = dto.Price,
        DurationMinutes = dto.DurationMinutes,

        DifficultyLevel = dto.DifficultyLevel?.Trim(),
        DistanceKm = dto.DistanceKm,
        StartPoint = dto.StartPoint?.Trim(),

        ExtraData = dto.ExtraData,

        Latitude = dto.Latitude,
        Longitude = dto.Longitude,
        Location = BuildLocation(dto.Latitude, dto.Longitude),

        Popularity = dto.Popularity,
        IsFeatured = dto.IsFeatured,
        IsDeleted = !dto.IsActive,
        DeletedAt = dto.IsActive ? null : now,

        OrganizerWebsite = dto.OrganizerWebsite?.Trim(),

        CreatedAt = now,
        UpdatedAt = now,
        CreatedBy = createdBy,
        UpdatedBy = createdBy
      };

      await _repository.AddAsync(activity);
      await _repository.SaveChangesAsync();

      var created = await GetByIdAsync(activity.Id, createdBy);

      return created!;
    }
    public Task<bool> DeleteAsync(Guid id, Guid currentUserId)
    {
      throw new NotImplementedException();
    }
    public async Task<AdminActivityDetailsDto?> GetByIdAsync(Guid id, Guid currentUserId)
    {
      var activity = await _repository.GetByIdAsync(id);

      if (activity == null) return null;

      return new AdminActivityDetailsDto
      {
        Id = activity.Id,

        CityId = activity.CityId,
        DestinationId = activity.DestinationId,
        PlaceId = activity.PlaceId,

        CategoryId = activity.CategoryId,
        SeasonId = activity.SeasonId,
        CountryId = activity.CountryId,

        Name = activity.Name,
        Slug = activity.Slug, 
        Description = activity.Description,

        Price = activity.Price,
        DurationMinutes = activity.DurationMinutes,

        DifficultyLevel = activity.DifficultyLevel,
        DistanceKm = activity.DistanceKm,
        StartPoint = activity.StartPoint,

        AvgRating = activity.AvgRating,
        Popularity = activity.Popularity,

        ExtraData = activity.ExtraData,

        Latitude = activity.Latitude,
        Longitude = activity.Longitude,

        IsFeatured = activity.IsFeatured,
        IsActive = !activity.IsDeleted,

        OrganizerWebsite = activity.OrganizerWebsite,

        PreviewImageUrl = activity.Images
          .OrderBy(i => i.SortOrder)
          .Select(i => i.ImageUrl)
          .FirstOrDefault(),

        CreatedAt = activity.CreatedAt,
        UpdatedAt = activity.UpdatedAt
      };
    }
    public Task<AdminActivityDetailsDto?> UpdateAsync(Guid id, AdminUpdateActivityDto dto, Guid updatedBy)
    {
      throw new NotImplementedException();
    }

    private static void ValidateCreateDto(AdminCreateActivityDto dto)
    {
      if(string.IsNullOrWhiteSpace(dto.Name)) throw new ArgumentException("Name is required");
      if(string.IsNullOrWhiteSpace(dto.Slug)) throw new ArgumentException("Slug is required");
      if(dto.CategoryId <= 0) throw new ArgumentException("CategoryId is required");
      if(dto.Price.HasValue && dto.Price.Value < 0) throw new ArgumentException("Price must be greater than or equal to 0");
      if(dto.DurationMinutes.HasValue && dto.DurationMinutes.Value < 0) throw new ArgumentException("DurationMinutes must be greater than 0");
      if(dto.Latitude.HasValue ^ dto.Longitude.HasValue) throw new ArgumentException("Latitude and Longitude must be provided together");
      if(dto.Latitude is < -90 or > 90) throw new ArgumentException("Latitude must be between -90 and 90");
      if(dto.Longitude is < -180 or > 180) throw new ArgumentException("Longitude must be between -180 and 180");
    }
    private static Point? BuildLocation(double? latitude, double? longitude)
    {
      if(!latitude.HasValue || !longitude.HasValue) return null;

      return new Point(longitude.Value, latitude.Value) {SRID = 4326};
    }
    private static void ValidatePagination(int page, int pageSize)
    {
      if (page < 1)
      {
        throw new ArgumentException("Page must be greater than or equal to 1.");
      }

      if (pageSize < 1 || pageSize > 50)
      {
        throw new ArgumentException("PageSize must be between 1 and 50.");
      }
    }

    private static string? GetDurationGroup(int? durationMinutes)
    {
      if(!durationMinutes.HasValue) return null;

      if(durationMinutes.Value <= 120) return "up_to_2h";

      if(durationMinutes.Value <= 360) return "from_2h_to_6h";

      return "multi_day";
    }
  }
}