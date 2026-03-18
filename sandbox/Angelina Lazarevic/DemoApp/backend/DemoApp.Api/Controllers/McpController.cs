using DemoApp.Api.Data;
using DemoApp.Api.Dtos;
using DemoApp.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DemoApp.Api.Controllers;

[ApiController]
[Route("api/mcp")]
public class McpController : ControllerBase
{
    private readonly AppDbContext _context;

    public McpController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents()
    {
        var eventsList = await _context.Events
            .OrderBy(e => e.Date)
            .ToListAsync();

        return Ok(eventsList);
    }

    [HttpPost("events")]
    public async Task<IActionResult> CreateEvent(EventDto dto)
    {
        var ev = new Event
        {
            Title = dto.Title,
            Description = dto.Description,
            Location = dto.Location,
            Date = DateTime.SpecifyKind(dto.Date, DateTimeKind.Utc),
            Capacity = dto.Capacity
        };

        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        return Ok(ev);
    }

    [HttpGet("registrations")]
    public async Task<IActionResult> GetRegistrations()
    {
        var registrations = await _context.Registrations
            .Include(r => r.User)
            .Include(r => r.Event)
            .Select(r => new
            {
                r.Id,
                r.RegisteredAt,
                User = new
                {
                    r.User.Id,
                    r.User.FullName,
                    r.User.Email
                },
                Event = new
                {
                    r.Event.Id,
                    r.Event.Title,
                    r.Event.Date,
                    r.Event.Location
                }
            })
            .ToListAsync();

        return Ok(registrations);
    }
}