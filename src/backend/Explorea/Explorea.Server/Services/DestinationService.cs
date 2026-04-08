using Explorea.API.DTOs.Common;
using Explorea.API.DTOs.Destination;
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
                PreviewImageUrl = d.PreviewImageUrl,
                HeroImageUrl = d.HeroImageUrl,
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
                    Lat = d.Latitude,
                    Lng = d.Longitude
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
                .Include(d => d.Events)
                .Include(d => d.Activities)
                .FirstOrDefaultAsync(d => d.Slug == slug);

            if (destination == null)
                return null;

            var similarDestinations = await _context.Destinations
                .Include(d => d.City)
                .Include(d => d.Country)
                .Where(d => d.Id != destination.Id)
                .OrderByDescending(d => d.Popularity)
                .Take(4)
                .ToListAsync();

            return new DestinationDetailDto
            {
                Id = destination.Id,
                Name = destination.Name,
                Slug = destination.Slug,
                Description = destination.Description,
                PreviewImageUrl = destination.PreviewImageUrl,
                HeroImageUrl = destination.HeroImageUrl,
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
                    Lat = destination.Latitude,
                    Lng = destination.Longitude
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
                    .Select(p => new
                    {
                        p.Id,
                        p.Name
                    })
                    .Cast<object>()
                    .ToList(),
                Events = destination.Events
                    .Select(e => new
                    {
                        e.Id,
                        e.Name
                    })
                    .Cast<object>()
                    .ToList(),
                Activities = destination.Activities
                    .Select(a => new
                    {
                        a.Id,
                        a.Name
                    })
                    .Cast<object>()
                    .ToList(),
                Reviews = new List<ReviewDto>(),
                SimilarDestinations = similarDestinations.Select(d => new DestinationCardDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Slug = d.Slug,
                    PreviewImageUrl = d.PreviewImageUrl,
                    HeroImageUrl = d.HeroImageUrl,
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
                        Lat = d.Latitude,
                        Lng = d.Longitude
                    }
                }).ToList()
            };
        }
    }
}