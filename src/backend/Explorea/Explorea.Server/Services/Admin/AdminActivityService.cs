using Explorea.API.DTOs.Admin.Activity;
using Explorea.Server.Repositories.Admin.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using Microsoft.EntityFrameworkCore;

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

      var activitiesQuery = _repository.Query()
        .OrderByDescending(a => a.CreatedAt);

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
    public Task<AdminActivityDetailsDto> CreateAsync(AdminCreateActivityDto dto, Guid createdBy)
    {
      throw new NotImplementedException();
    }
    public Task<bool> DeleteAsync(Guid id, Guid currentUserId)
    {
      throw new NotImplementedException();
    }
    public Task<AdminActivityDetailsDto?> GetByIdAsync(Guid id, Guid currentUserId)
    {
      throw new NotImplementedException();
    }
    public Task<AdminActivityDetailsDto?> UpdateAsync(Guid id, AdminUpdateActivityDto dto, Guid updatedBy)
    {
      throw new NotImplementedException();
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