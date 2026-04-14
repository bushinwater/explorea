using Explorea.API.DTOs.Destination;
using Explorea.API.DTOs.Place;
using Explorea.API.DTOs.Common;

namespace Explorea.API.DTOs.Event
{
    public class EventCardDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public TypeRefDto? Type { get; set; }
        public DateTimeOffset StartDatetime { get; set; }
        public DateTimeOffset EndDatetime { get; set; }
        public decimal? Price { get; set; }
        public string? Address { get; set; }
        public CityRefDto? City { get; set; }
        public string? PreviewImageUrl { get; set; }
        public bool IsFeatured { get; set; }
        public int Popularity { get; set; }
        public double? DistanceKm{get; set;}
        public CountryRefDto? Country { get; set; }
    }
}