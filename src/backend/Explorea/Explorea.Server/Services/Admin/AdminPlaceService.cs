using System.Text.Json;
using Explorea.API.DTOs.Admin.Place;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using NetTopologySuite.Geometries;

namespace Explorea.Server.Services.Admin
{
  public class AdminPlaceService : IAdminPlaceService
  {
    private readonly IAdminPlaceRepository _placeRepo;
    private readonly IOrganizationAssignmentRepository _assignmentRepo;
    private readonly IUserRepository _userRepo;
    private readonly ISubmissionQueueRepository _queueRepo;
  
    private static readonly GeometryFactory _geometryFactory =
        new GeometryFactory(new PrecisionModel(), 4326);
  
    public AdminPlaceService(
        IAdminPlaceRepository placeRepo,
        IOrganizationAssignmentRepository assignmentRepo,
        IUserRepository userRepo,
        ISubmissionQueueRepository queueRepo)
    {
        _placeRepo = placeRepo;
        _assignmentRepo = assignmentRepo;
        _userRepo = userRepo;
        _queueRepo = queueRepo;
    }
  
    public async Task<(List<AdminPlaceListDto> Items, int Total)> GetAllAsync(
        Guid? destinationId,
        int? cityId,
        int? typeId,
        string? visibility,
        bool? isFeatured,
        int page,
        int pageSize,
        Guid currentUserId)
    {
      var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
  
      List<Guid>? restrictToDestinationIds = null;
  
      if (user?.Role.Name == RoleNames.TouristOrganization)
      {
          var assignments = await _assignmentRepo.GetByUserIdAsync(currentUserId);
          restrictToDestinationIds = assignments.Select(a => a.DestinationId).ToList();
      }
      else if (user?.Role.Name != RoleNames.SuperAdmin)
      {
          throw new UnauthorizedAccessException("Access denied.");
      }
  
      // NOTE:
      // Place model trenutno nema Visibility kolonu.
      // visibility parametar zadržavamo radi buduće kompatibilnosti API-ja,
      // ali ga sada nije moguće primeniti na query bez izmene modela.
      var (items, total) = await _placeRepo.GetAdminPagedAsync(
          destinationId,
          cityId,
          typeId,
          isFeatured,
          restrictToDestinationIds,
          page,
          pageSize);
  
      return (items.Select(MapToListDto).ToList(), total);
    }
  
    public async Task<AdminPlaceDetailDto?> GetByIdAsync(Guid id, Guid currentUserId)
    {
        var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
  
        var place = await _placeRepo.GetAdminByIdAsync(id);
        if (place == null) return null;
  
        if (user?.Role.Name == RoleNames.TouristOrganization)
        {
            if (!place.DestinationId.HasValue)
                return null;
  
            var hasAccess = await _assignmentRepo.ExistsAsync(currentUserId, place.DestinationId.Value);
            if (!hasAccess) return null;
        }
        else if (user?.Role.Name != RoleNames.SuperAdmin)
        {
            throw new UnauthorizedAccessException("Access denied.");
        }
  
        return MapToDetailDto(place);
    }
  
    public async Task<AdminPlaceDetailDto> CreateAsync(AdminCreatePlaceDto dto, Guid createdBy)
    {
        var user = await _userRepo.GetByIdWithRoleAsync(createdBy);
  
          if (user?.Role.Name == RoleNames.TouristOrganization)
          {
              if (!dto.DestinationId.HasValue)
                  throw new UnauthorizedAccessException("DestinationId is required for Tourist Organization users.");
  
              var hasAccess = await _assignmentRepo.ExistsAsync(createdBy, dto.DestinationId.Value);
              if (!hasAccess)
                  throw new UnauthorizedAccessException("You do not have access to this destination.");
          }
          else if (user?.Role.Name != RoleNames.SuperAdmin)
          {
              throw new UnauthorizedAccessException("Only SuperAdmin or TouristOrganization can create places.");
          }
  
          var now = DateTimeOffset.UtcNow;
  
          var place = new Place
          {
              Id = Guid.NewGuid(),
              DestinationId = dto.DestinationId,
              CityId = dto.CityId,
              CountryId = dto.CountryId,
              TypeId = dto.TypeId,
              Name = dto.Name,
              Slug = dto.Slug,
              Description = dto.Description,
              Address = dto.Address,
              Latitude = dto.Latitude,
              Longitude = dto.Longitude,
              Location = CreatePoint(dto.Latitude, dto.Longitude),
              PriceRange = dto.PriceRange,
              Phone = dto.Phone,
              WebsiteUrl = dto.WebsiteUrl,
              IsFeatured = dto.IsFeatured,
              CreatedAt = now,
              UpdatedAt = now,
              CreatedBy = createdBy,
              UpdatedBy = createdBy
          };
  
          foreach (var image in dto.Images)
          {
              place.Images.Add(new PlaceImage
              {
                  Id = Guid.NewGuid(),
                  PlaceId = place.Id,
                  ImageUrl = image.ImageUrl,
                  Caption = image.Caption,
                  SortOrder = image.SortOrder,
                  CreatedAt = now,
                  CreatedBy = createdBy,
                  UpdatedBy = createdBy
              });
          }
  
          foreach (var amenityId in dto.AmenityIds.Distinct())
          {
              place.AmenityLinks.Add(new PlaceAmenityLink
              {
                  PlaceId = place.Id,
                  AmenityId = amenityId
              });
          }
  
          foreach (var workingDay in dto.WorkingDays)
          {
              var workingDayEntity = new PlaceWorkingDay
              {
                  Id = Guid.NewGuid(),
                  PlaceId = place.Id,
                  DayOfWeek = workingDay.DayOfWeek,
                  IsClosed = workingDay.IsClosed,
                  Note = workingDay.Note,
                  CreatedAt = now,
                  UpdatedAt = now,
                  CreatedBy = createdBy,
                  UpdatedBy = createdBy
              };
  
          foreach (var interval in workingDay.Intervals)
          {
            workingDayEntity.Intervals.Add(new PlaceWorkingHourInterval
            {
              Id = Guid.NewGuid(),
              WorkingDayId = workingDayEntity.Id,
              OpensAt = interval.OpensAt,
              ClosesAt = interval.ClosesAt,
              CreatedAt = now,
              CreatedBy = createdBy,
              UpdatedBy = createdBy
            });
          }
  
          place.WorkingDays.Add(workingDayEntity);
        }
  
        await _placeRepo.AddAsync(place);
        await _placeRepo.SaveChangesAsync();
  
        var created = await _placeRepo.GetAdminByIdAsync(place.Id);
        return MapToDetailDto(created!);
    }
  
    public async Task<AdminPlaceDetailDto?> UpdateAsync(Guid id, AdminUpdatePlaceDto dto, Guid updatedBy)
    {
        var user = await _userRepo.GetByIdWithRoleAsync(updatedBy);
        var place = await _placeRepo.GetAdminByIdAsync(id);
  
        if (place == null) return null;
  
        if (user?.Role.Name == RoleNames.TouristOrganization)
        {
            if (!place.DestinationId.HasValue)
                throw new UnauthorizedAccessException("Place has no destination assigned.");
  
          var hasAccess = await _assignmentRepo.ExistsAsync(updatedBy, place.DestinationId.Value);
          if (!hasAccess)
              throw new UnauthorizedAccessException("You do not have access to this place.");
        }
        else if (user?.Role.Name != RoleNames.SuperAdmin)
        {
          throw new UnauthorizedAccessException("Only SuperAdmin or TouristOrganization can update places.");
        }
  
        if (dto.DestinationId.HasValue && user?.Role.Name == RoleNames.TouristOrganization)
        {
            var hasAccess = await _assignmentRepo.ExistsAsync(updatedBy, dto.DestinationId.Value);
            if (!hasAccess)
                throw new UnauthorizedAccessException("You do not have access to the target destination.");
        }
  
        if (dto.Name != null) place.Name = dto.Name;
        if (dto.Slug != null) place.Slug = dto.Slug;
        if (dto.Description != null) place.Description = dto.Description;
        if (dto.Address != null) place.Address = dto.Address;
        if (dto.DestinationId.HasValue) place.DestinationId = dto.DestinationId.Value;
        if (dto.CityId.HasValue) place.CityId = dto.CityId.Value;
        if (dto.CountryId.HasValue) place.CountryId = dto.CountryId.Value;
        if (dto.TypeId.HasValue) place.TypeId = dto.TypeId.Value;
        if (dto.PriceRange != null) place.PriceRange = dto.PriceRange;
        if (dto.Phone != null) place.Phone = dto.Phone;
        if (dto.WebsiteUrl != null) place.WebsiteUrl = dto.WebsiteUrl;
        if (dto.IsFeatured.HasValue) place.IsFeatured = dto.IsFeatured.Value;
  
        if (dto.Latitude.HasValue && dto.Longitude.HasValue)
        {
            place.Latitude = dto.Latitude.Value;
            place.Longitude = dto.Longitude.Value;
            place.Location = CreatePoint(dto.Latitude, dto.Longitude);
        }
  
        if (dto.Images != null)
        {
            _placeRepo.RemoveImages(place.Images);
  
            var now = DateTimeOffset.UtcNow;
            place.Images = dto.Images.Select(x => new PlaceImage
            {
                Id = Guid.NewGuid(),
                PlaceId = place.Id,
                ImageUrl = x.ImageUrl,
                Caption = x.Caption,
                SortOrder = x.SortOrder,
                CreatedAt = now,
                CreatedBy = place.CreatedBy,
                UpdatedBy = updatedBy
            }).ToList();
        }
  
        if (dto.AmenityIds != null)
        {
            _placeRepo.RemoveAmenityLinks(place.AmenityLinks);
  
            place.AmenityLinks = dto.AmenityIds
                .Distinct()
                .Select(id => new PlaceAmenityLink
                {
                    PlaceId = place.Id,
                    AmenityId = id
                })
                .ToList();
        }
  
        if (dto.WorkingDays != null)
            {
                var newWorkingDays = new List<PlaceWorkingDay>();
                var now = DateTimeOffset.UtcNow;
            
                foreach (var wd in dto.WorkingDays)
                {
                    var dayId = Guid.NewGuid();
            
                    var day = new PlaceWorkingDay
                    {
                        Id = dayId,
                        PlaceId = place.Id,
                        DayOfWeek = wd.DayOfWeek,
                        IsClosed = wd.IsClosed,
                        Note = wd.Note,
                        CreatedAt = now,
                        UpdatedAt = now,
                        CreatedBy = place.CreatedBy,
                        UpdatedBy = updatedBy
                    };
            
                    foreach (var interval in wd.Intervals)
                    {
                        day.Intervals.Add(new PlaceWorkingHourInterval
                        {
                            Id = Guid.NewGuid(),
                            WorkingDayId = dayId,
                            OpensAt = interval.OpensAt,
                            ClosesAt = interval.ClosesAt,
                            CreatedAt = now,
                            CreatedBy = place.CreatedBy,
                            UpdatedBy = updatedBy
                        });
                    }
            
                    newWorkingDays.Add(day);
                }
            
                await _placeRepo.ReplaceWorkingDaysAsync(place.Id, newWorkingDays);
            }
  
        place.UpdatedAt = DateTimeOffset.UtcNow;
        place.UpdatedBy = updatedBy;
  
        _placeRepo.Update(place);
        await _placeRepo.SaveChangesAsync();
  
        var updated = await _placeRepo.GetAdminByIdAsync(id);
        return MapToDetailDto(updated!);
      }
  
      public async Task<bool> DeleteAsync(Guid id, Guid currentUserId)
      {
        var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
        var place = await _placeRepo.GetAdminByIdAsync(id);
  
        if (place == null) return false;
  
        if (user?.Role.Name == RoleNames.TouristOrganization)
        {
            if (!place.DestinationId.HasValue)
                throw new UnauthorizedAccessException("Place has no destination assigned.");
  
            var hasAccess = await _assignmentRepo.ExistsAsync(currentUserId, place.DestinationId.Value);
            if (!hasAccess)
                throw new UnauthorizedAccessException("You do not have access to this place.");
        }
        else if (user?.Role.Name != RoleNames.SuperAdmin)
        {
            throw new UnauthorizedAccessException("Access denied.");
        }
  
        place.IsDeleted = true;
        place.DeletedAt = DateTimeOffset.UtcNow;
        place.UpdatedAt = DateTimeOffset.UtcNow;
        place.UpdatedBy = currentUserId;
  
        _placeRepo.Update(place);
        await _placeRepo.SaveChangesAsync();
  
        return true;
      }
  
      public async Task<List<AdminMyPlaceDto>> GetMyPlacesAsync(Guid currentUserId)
      {
        var places = await _placeRepo.GetMyPlacesAsync(currentUserId);
  
        return places.Select(p => new AdminMyPlaceDto
        {
            Id = p.Id,
            Name = p.Name,
            PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
            AvgRating = p.AvgRating,
            Status = p.IsDeleted ? "deleted" : "active"
        }).ToList();
      }
  
    public async Task SubmitPlaceRequestAsync(SubmitPlaceRequestDto dto, Guid currentUserId)
    {
        var user = await _userRepo.GetByIdWithRoleAsync(currentUserId);
  
        if (user?.Role.Name == RoleNames.SuperAdmin || user?.Role.Name == RoleNames.TouristOrganization)
          throw new UnauthorizedAccessException("Admins should create places directly, not through queue requests.");
    
        var payload = new PlaceRequestPayloadDto
        {
            Name = dto.Name,
            Description = dto.Description,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Images = dto.Images ?? new List<string>(),
            Documents = dto.Documents ?? new List<string>(),
            TypeId = dto.TypeId,
            CityId = dto.CityId
        };

        var queueItem = new SubmissionQueue
        {
            Id = Guid.NewGuid(),
            EntityType = "place",
            EntityId = Guid.NewGuid(),
            DestinationId = dto.DestinationId,
            Status = "Pending",
            SubmittedByUserId = currentUserId,
            SubmittedAt = DateTimeOffset.UtcNow,
            RequestPayload = JsonSerializer.Serialize(payload)
        };

        await _queueRepo.AddAsync(queueItem);
        await _queueRepo.SaveChangesAsync();
    }
  
      private static Point CreatePoint(double? latitude, double? longitude)
      {
        var lng = longitude ?? 0;
        var lat = latitude ?? 0;
        return _geometryFactory.CreatePoint(new Coordinate(lng, lat));
      }
  
      private static AdminPlaceListDto MapToListDto(Place p) => new()
      {
        Id = p.Id,
        Name = p.Name,
        Slug = p.Slug,
        PreviewImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
        Type = p.Type?.Name,
        City = p.City?.Name,
        Destination = p.Destination?.Name,
        AvgRating = p.AvgRating,
        IsFeatured = p.IsFeatured,
        Address = p.Address,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
      };
  
      private static AdminPlaceDetailDto MapToDetailDto(Place p) => new()
      {
          Id = p.Id,
          DestinationId = p.DestinationId,
          CityId = p.CityId,
          CountryId = p.CountryId,
          TypeId = p.TypeId,
          Name = p.Name,
          Slug = p.Slug,
          Description = p.Description,
          Address = p.Address,
          Latitude = p.Latitude,
          Longitude = p.Longitude,
          PriceRange = p.PriceRange,
          Phone = p.Phone,
          WebsiteUrl = p.WebsiteUrl,
          AvgRating = p.AvgRating,
          IsFeatured = p.IsFeatured,
          Type = p.Type?.Name,
          City = p.City?.Name,
          Destination = p.Destination?.Name,
          Country = p.Country?.Name,
          Images = p.Images
              .OrderBy(i => i.SortOrder)
              .Select(i => new AdminPlaceImageDto
              {
                  Id = i.Id,
                  ImageUrl = i.ImageUrl,
                  Caption = i.Caption,
                  SortOrder = i.SortOrder
              })
              .ToList(),
          Amenities = p.AmenityLinks
              .Select(al => new AdminPlaceAmenityDto
              {
                  Id = al.AmenityId,
                  Name = al.Amenity.Name
              })
              .ToList(),
          WorkingDays = p.WorkingDays
            .OrderBy(wd => wd.DayOfWeek)
            .Select(wd => new AdminPlaceWorkingDayDto
            {
                Id = wd.Id,
                DayOfWeek = wd.DayOfWeek,
                IsClosed = wd.IsClosed,
                Note = wd.Note,
                Intervals = wd.Intervals
                  .OrderBy(i => i.OpensAt)
                  .Select(i => new AdminPlaceWorkingHourIntervalDto
                  {
                      Id = i.Id,
                      OpensAt = i.OpensAt,
                      ClosesAt = i.ClosesAt
                  })
                  .ToList()
            })
            .ToList(),
          CreatedAt = p.CreatedAt,
          UpdatedAt = p.UpdatedAt
      };
    }
} 