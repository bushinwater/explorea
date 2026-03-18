using System.Security.Claims;
using DemoApp.Api.Data;
using DemoApp.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DemoApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RegistrationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public RegistrationsController(AppDbContext context)
    {
        _context = context;
    }

    [Authorize]
    [HttpPost("{eventId}")]
    public async Task<IActionResult> RegisterForEvent(int eventId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null)
            return Unauthorized();

        var userId = int.Parse(userIdClaim);

        var ev = await _context.Events
            .Include(e => e.Registrations)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (ev == null)
            return NotFound(new { message = "Event not found." });

        var alreadyRegistered = await _context.Registrations
            .AnyAsync(r => r.UserId == userId && r.EventId == eventId);

        if (alreadyRegistered)
            return BadRequest(new { message = "You are already registered for this event." });

        if (ev.Registrations.Count >= ev.Capacity)
            return BadRequest(new { message = "Event is full." });

        var registration = new Registration
        {
            UserId = userId,
            EventId = eventId
        };

        _context.Registrations.Add(registration);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Successfully registered for event." });
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> MyRegistrations()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null)
            return Unauthorized();

        var userId = int.Parse(userIdClaim);

        var registrations = await _context.Registrations
            .Where(r => r.UserId == userId)
            .Include(r => r.Event)
            .Select(r => new
            {
                r.Id,
                r.RegisteredAt,
                Event = new
                {
                    r.Event.Id,
                    r.Event.Title,
                    r.Event.Description,
                    r.Event.Location,
                    r.Event.Date,
                    r.Event.Capacity
                }
            })
            .ToListAsync();

        return Ok(registrations);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<IActionResult> GetAll()
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