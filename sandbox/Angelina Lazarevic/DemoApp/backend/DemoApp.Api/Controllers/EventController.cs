using DemoApp.Api.Data;
using DemoApp.Api.Dtos;
using DemoApp.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DemoApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _context;

    public EventsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var eventsList = await _context.Events
            .OrderBy(e => e.Date)
            .ToListAsync();

        return Ok(eventsList);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var ev = await _context.Events.FindAsync(id);
        if (ev == null)
            return NotFound();

        return Ok(ev);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create(EventDto dto)
    {
        try
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
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = ex.Message,
                inner = ex.InnerException?.Message
            });
        }
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, EventDto dto)
    {
        var ev = await _context.Events.FindAsync(id);
        if (ev == null)
            return NotFound();

        ev.Title = dto.Title;
        ev.Description = dto.Description;
        ev.Location = dto.Location;
        ev.Date = DateTime.SpecifyKind(dto.Date, DateTimeKind.Utc); ;
        ev.Capacity = dto.Capacity;

        await _context.SaveChangesAsync();

        return Ok(ev);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ev = await _context.Events.FindAsync(id);
        if (ev == null)
            return NotFound();

        _context.Events.Remove(ev);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}