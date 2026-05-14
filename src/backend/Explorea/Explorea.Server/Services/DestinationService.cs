using Explorea.API.DTOs.Activity;
using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Event;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Review;
using Explorea.Server.Data;
using Explorea.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Explorea.Server.Services
{
    public class DestinationService : IDestinationService
    {
        private readonly AppDbContext _context;

        public DestinationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<DestinationCardDto>> GetAllAsync()
        {
            var destinations = await _context.Destinations
                .Include(d => d.City)
                .Include(d => d.Country)
                .OrderByDescending(d => d.Popularity)
                .ToListAsync();

            return destinations.Select(d => new DestinationCardDto
            {
                Id = d.Id,
                Name = d.Name,
                Slug = d.Slug,
                PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
                HeroImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
                AvgRating = d.AvgRating,
                IsFeatured = d.IsFeatured,
                Popularity = d.Popularity,
                City = d.City == null ? null : new CityRefDto
                {
                    Id = d.City.Id,
                    Name = d.City.Name
                },
                Country = d.Country == null ? null : new CountryRefDto
                {
                    Id = d.Country.Id,
                    Name = d.Country.Name,
                    Code = d.Country.Code
                },
                Location = new LocationDto
                {
                    Lat = d.Latitude.Value,
                    Lng = d.Longitude.Value
                }
            });
        }

        public async Task<DestinationDetailDto?> GetBySlugAsync(string slug)
        {
            var destination = await _context.Destinations
                .Include(d => d.City)
                .Include(d => d.Country)
                .Include(d => d.Images)

                .Include(d => d.Places)
                    .ThenInclude(p => p.Images)
                .Include(d => d.Places)
                    .ThenInclude(p => p.Country)

                .Include(d => d.Events)
                    .ThenInclude(e => e.Images)
                .Include(d => d.Events)
                    .ThenInclude(e => e.City)
                .Include(d => d.Events)
                    .ThenInclude(e => e.Country)

                .Include(d => d.Activities)
                    .ThenInclude(a => a.Images)
                .Include(d => d.Activities)
                    .ThenInclude(a => a.Country)

                .FirstOrDefaultAsync(d => d.Slug == slug);

            if (destination == null)
                return null;

            var currentTagIds = await _context.DestinationInterestTags
                .Where(dit => dit.DestinationId == destination.Id)
                .Select(dit => dit.InterestTagId)
                .ToListAsync();

            var candidates = await _context.Destinations
                .Include(d => d.City)
                .Include(d => d.Country)
                .Where(d => d.Id != destination.Id && !d.IsDeleted)
                .ToListAsync();

            var candidateIds = candidates.Select(d => d.Id).ToList();
            var tagMappings = await _context.DestinationInterestTags
                .Where(dit => candidateIds.Contains(dit.DestinationId))
                .Select(dit => new { dit.DestinationId, dit.InterestTagId })
                .ToListAsync();

            var tagsByDestination = tagMappings
                .GroupBy(m => m.DestinationId)
                .ToDictionary(g => g.Key, g => g.Select(m => m.InterestTagId).ToHashSet());

            var similarDestinations = candidates
                .Select(d => new
                {
                    Destination = d,
                    Score =
                        (tagsByDestination.TryGetValue(d.Id, out var tags)
                            ? tags.Count(tagId => currentTagIds.Contains(tagId)) * 3
                            : 0) +
                        (d.CountryId.HasValue && d.CountryId == destination.CountryId ? 2 : 0) +
                        (d.CityId.HasValue && d.CityId == destination.CityId ? 1 : 0)
                })
                .OrderByDescending(c => c.Score)
                .ThenByDescending(c => c.Destination.Popularity)
                .Take(6)
                .Select(c => c.Destination)
                .ToList();

            var reviews = await _context.Reviews
                .Include(r => r.User)
                .Where(r => r.EntityType == "destination" && r.EntityId == destination.Id)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ReviewDto
                {
                    Id = r.Id,
                    Rating = r.Rating,
                    Comment = r.Comment,
                    CreatedAt = r.CreatedAt,
                    User = new ReviewUserDto
                    {
                        Id = r.User.Id,
                        FirstName = r.User.FirstName,
                        LastName = r.User.LastName,
                        TravelerRank = r.User.TravelerRank,
                        ProfileImageUrl = r.User.ProfileImageUrl
                    }
                })
                .ToListAsync();

            return new DestinationDetailDto
            {
                Id = destination.Id,
                Name = destination.Name,
                Slug = destination.Slug,
                Description = destination.Description,
                PreviewImageUrl = destination.PreviewImageUrl ?? destination.HeroImageUrl,
                HeroImageUrl = destination.PreviewImageUrl ?? destination.HeroImageUrl,
                AvgRating = destination.AvgRating,
                IsFeatured = destination.IsFeatured,
                Popularity = destination.Popularity,

                City = destination.City == null ? null : new CityRefDto
                {
                    Id = destination.City.Id,
                    Name = destination.City.Name
                },

                Country = destination.Country == null ? null : new CountryRefDto
                {
                    Id = destination.Country.Id,
                    Name = destination.Country.Name,
                    Code = destination.Country.Code
                },

                Location = new LocationDto
                {
                    Lat = destination.Latitude.Value,
                    Lng = destination.Longitude.Value
                },

                Images = destination.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new DestinationImageDto
                    {
                        ImageUrl = i.ImageUrl,
                        SortOrder = i.SortOrder
                    })
                    .ToList(),

                Places = destination.Places
                    .OrderByDescending(p => p.Popularity)
                    .Select(p => new PlaceCardDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        Slug = p.Slug,
                        AvgRating = p.AvgRating,
                        Address = p.Address,
                        PriceRange = p.PriceRange,
                        IsOpen = false,
                        Popularity = p.Popularity,
                        PreviewImageUrl = p.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Country = p.Country == null ? null : new CountryRefDto
                        {
                            Id = p.Country.Id,
                            Name = p.Country.Name,
                            Code = p.Country.Code
                        }
                    })
                    .ToList(),

                Events = destination.Events
                    .OrderByDescending(e => e.Popularity)
                    .Select(e => new EventCardDto
                    {
                        Id = e.Id,
                        Name = e.Name,
                        Slug = e.Slug,
                        StartDatetime = e.StartDatetime,
                        EndDatetime = e.EndDatetime,
                        AvgRating = e.AvgRating,
                        Price = e.Price,
                        Address = e.Address,
                        IsFeatured = e.IsFeatured,
                        Popularity = e.Popularity,
                        PreviewImageUrl = e.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        City = e.City == null ? null : new CityRefDto
                        {
                            Id = e.City.Id,
                            Name = e.City.Name
                        },
                        Country = e.Country == null ? null : new CountryRefDto
                        {
                            Id = e.Country.Id,
                            Name = e.Country.Name,
                            Code = e.Country.Code
                        }
                    })
                    .ToList(),

                Activities = destination.Activities
                    .OrderByDescending(a => a.Popularity)
                    .Select(a => new ActivityCardDto
                    {
                        Id = a.Id,
                        Name = a.Name,
                        Slug = a.Slug,
                        AvgRating = a.AvgRating,
                        DurationMinutes = a.DurationMinutes,
                        Price = a.Price,
                        DifficultyLevel = a.DifficultyLevel,
                        Popularity = a.Popularity,
                        PreviewImageUrl = a.Images
                            .OrderBy(i => i.SortOrder)
                            .Select(i => i.ImageUrl)
                            .FirstOrDefault(),
                        Country = a.Country == null ? null : new CountryRefDto
                        {
                            Id = a.Country.Id,
                            Name = a.Country.Name,
                            Code = a.Country.Code
                        }
                    })
                    .ToList(),

                Reviews = reviews,

                SimilarDestinations = similarDestinations.Select(d => new DestinationCardDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Slug = d.Slug,
                    PreviewImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
                    HeroImageUrl = d.PreviewImageUrl ?? d.HeroImageUrl,
                    AvgRating = d.AvgRating,
                    IsFeatured = d.IsFeatured,
                    Popularity = d.Popularity,
                    City = d.City == null ? null : new CityRefDto
                    {
                        Id = d.City.Id,
                        Name = d.City.Name
                    },
                    Country = d.Country == null ? null : new CountryRefDto
                    {
                        Id = d.Country.Id,
                        Name = d.Country.Name,
                        Code = d.Country.Code
                    },
                    Location = new LocationDto
                    {
                        Lat = d.Latitude.Value,
                        Lng = d.Longitude.Value
                    }
                }).ToList()
            };
        }
    }
}