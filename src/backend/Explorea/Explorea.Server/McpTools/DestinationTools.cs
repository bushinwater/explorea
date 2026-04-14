using System.ComponentModel;
using System.Text.Json;
using Explorea.Server.Services.Interfaces;
using ModelContextProtocol.Server;

namespace Explorea.Server.McpTools
{
    [McpServerToolType]
    public class DestinationTools(IDestinationService destinationService)
    {
        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        [McpServerTool(Name = "get_destination_details"), Description(
            "Returns detailed information about a specific tourist destination: " +
            "full description, location, average rating, city, country, and similar destinations. " +
            "Use this when the user wants to learn about a specific destination. " +
            "Requires the destination slug (URL-friendly name, e.g. 'fruska-gora', 'kopaonik').")]
        public async Task<string> GetDestinationDetails(
            [Description("URL slug of the destination (e.g. 'fruska-gora', 'kopaonik', 'tara')")] string slug)
        {
            var destination = await destinationService.GetBySlugAsync(slug);

            if (destination is null)
                return JsonSerializer.Serialize(new { error = $"Destination '{slug}' not found." }, _json);

            var result = new
            {
                destination.Id,
                destination.Name,
                destination.Slug,
                destination.Description,
                destination.AvgRating,
                destination.IsFeatured,
                destination.Popularity,
                city = destination.City?.Name,
                country = destination.Country?.Name,
                location = destination.Location,
                imageCount = destination.Images.Count,
                similarDestinations = destination.SimilarDestinations.Select(d => new
                {
                    d.Name,
                    d.Slug,
                    d.AvgRating,
                    city = d.City?.Name
                })
            };

            return JsonSerializer.Serialize(result, _json);
        }

        [McpServerTool(Name = "get_destination_content"), Description(
            "Returns activities, events and places associated with a specific destination. " +
            "Use this when the user asks what they can do, see or visit at a destination, " +
            "or wants help planning a trip there. " +
            "Requires the destination slug (URL-friendly name, e.g. 'fruska-gora', 'kopaonik').")]
        public async Task<string> GetDestinationContent(
            [Description("URL slug of the destination (e.g. 'fruska-gora', 'kopaonik', 'tara')")] string slug)
        {
            var destination = await destinationService.GetBySlugAsync(slug);

            if (destination is null)
                return JsonSerializer.Serialize(new { error = $"Destination '{slug}' not found." }, _json);

            var result = new
            {
                destinationName = destination.Name,
                activities = destination.Activities.Select(a => new
                {
                    a.Name,
                    a.Slug,
                    category = a.Category?.Name,
                    a.DifficultyLevel,
                    durationMinutes = a.DurationMinutes,
                    price = a.Price,
                    avgRating = a.AvgRating
                }),
                events = destination.Events.Select(e => new
                {
                    e.Name,
                    e.Slug,
                    type = e.Type?.Name,
                    startDatetime = e.StartDatetime,
                    endDatetime = e.EndDatetime,
                    price = e.Price,
                    address = e.Address,
                    city = e.City?.Name
                }),
                places = destination.Places.Select(p => new
                {
                    p.Name,
                    p.Slug,
                    type = p.Type?.Name,
                    avgRating = p.AvgRating,
                    address = p.Address,
                    priceRange = p.PriceRange
                })
            };

            return JsonSerializer.Serialize(result, _json);
        }
    }
}
