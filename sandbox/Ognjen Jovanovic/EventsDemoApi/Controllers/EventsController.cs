using EventsDemoApi.Data;
using EventsDemoApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EventsDemoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase {
  private readonly AppDbContext _context;

  public EventsController(AppDbContext context) { _context = context; }

  [HttpGet]
  public async Task<ActionResult<IEnumerable<Event>>> GetAll()
  {
    var events = await _context.Events.Where(e => !e.IsDeleted).OrderBy(e => e.EventDate).ToListAsync();

    return Ok(events);
  }

  [HttpGet("{id}")]
  public async Task<ActionResult<Event>> GetById(int id)
  {
    var eventItem = await _context.Events.FindAsync(id);

    if(eventItem == null || eventItem.IsDeleted) return NotFound();

    return Ok(eventItem);
  }

  [HttpGet("deleted")]
  public async Task<ActionResult<IEnumerable<Event>>> GetDeleted()
  {
    var deletedEvents = await _context.Events.Where(e => e.IsDeleted).OrderByDescending(e => e.DeletedAt).ToListAsync();

    return Ok(deletedEvents);
  }

  [HttpPost]
  public async Task<ActionResult<Event>> Create(Event eventItem)
  {
    eventItem.EventDate = DateTime.SpecifyKind(eventItem.EventDate, DateTimeKind.Utc);
    eventItem.Created = DateTime.UtcNow;
    eventItem.Updated = DateTime.UtcNow;

    _context.Events.Add(eventItem);
    await _context.SaveChangesAsync();

    return CreatedAtAction(nameof(GetById), new { id = eventItem.Id }, eventItem);
  }

  [HttpPut("{id}")]
  public async Task<IActionResult> Update(int id, Event updatedEvent)
  {
    if(id != updatedEvent.Id) 
      return BadRequest("Id iz URLa i tela zahteva se ne poklapaju");
    
    var existingEvent = await _context.Events.FindAsync(id);

    if (existingEvent == null || existingEvent.IsDeleted) return NotFound();

    existingEvent.Title = updatedEvent.Title;
    existingEvent.Description = updatedEvent.Description;
    existingEvent.EventDate = DateTime.SpecifyKind(updatedEvent.EventDate, DateTimeKind.Utc);
    existingEvent.Location = updatedEvent.Location;
    existingEvent.IsCompleted = updatedEvent.IsCompleted;
    existingEvent.Updated = DateTime.UtcNow;

    await _context.SaveChangesAsync();

    return NoContent();
  }

  [HttpPut("{id}/restore")]
  public async Task<IActionResult> Restore(int id)
  {
    var eventItem = await _context.Events.FindAsync(id);

    if(eventItem == null || !eventItem.IsDeleted) return NotFound();

    eventItem.IsDeleted = false;
    eventItem.DeletedAt = null;
    eventItem.Updated = DateTime.UtcNow;

    await _context.SaveChangesAsync();
    
    return NoContent();
  }

  [HttpDelete("{id}")]
  public async Task<IActionResult> Delete(int id)
  {
    var eventItem = await _context.Events.FindAsync(id);

    if(eventItem == null || eventItem.IsDeleted) return NotFound();

    eventItem.IsDeleted = true;
    eventItem.DeletedAt = DateTime.UtcNow;
    eventItem.Updated = DateTime.UtcNow;

    await _context.SaveChangesAsync();

    return NoContent();
  }

  [HttpDelete("deleted/cleanup")]
  public async Task<IActionResult> CleanupDeleted()
  {
    var cutoff = DateTime.UtcNow.AddSeconds(-10);

    var oldDeletedEvents = await _context.Events
        .Where(e => e.IsDeleted && e.DeletedAt != null)
        .ToListAsync();

    _context.Events.RemoveRange(oldDeletedEvents);
    await _context.SaveChangesAsync();

    return NoContent();
  }
}