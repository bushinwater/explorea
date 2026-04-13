using Explorea.API.DTOs.Event;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/events")]
    public class EventsController : ControllerBase
    {
        private readonly IEventService _eventService;

        public EventsController(IEventService eventService)
        {
            _eventService = eventService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] GetEventsQueryDto query)
        {
            var result = await _eventService.GetEventsAsync(query);

            return Ok(new
            {
                items = result.Items,
                total = result.Total,
                page = query.Page,
                pageSize = query.PageSize
            });
        }

        [HttpGet("{slug}")]
        public async Task<IActionResult> GetBySlug(string slug)
        {
            var eventDetails = await _eventService.GetBySlugAsync(slug);

            if (eventDetails == null)
                return NotFound();

            return Ok(eventDetails);
        }

        [HttpGet("calendar")]
        public async Task<IActionResult> GetCalendar([FromQuery] GetEventCalendarQueryDto query)
        {
            var result = await _eventService.GetCalendarAsync(query);
            return Ok(result);
        }
    }
}