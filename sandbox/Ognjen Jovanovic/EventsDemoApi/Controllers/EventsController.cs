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
    var events = await _context.Events.OrderBy(e => e.EventDate).ToListAsync();

    return Ok(events);
  }

  [HttpGet("{id}")]
  public async Task<ActionResult<Event>> GetById(int id)
  {
    var eventItem = await _context.Events.FindAsync(id);

    if(eventItem == null) return NotFound();

    return Ok(eventItem);
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
    
    var exsistingEvent = await _context.Events.FindAsync(id);

    if (exsistingEvent == null) return NotFound();

    exsistingEvent.Title = updatedEvent.Title;
    exsistingEvent.Description = updatedEvent.Description;
    exsistingEvent.EventDate = DateTime.SpecifyKind(updatedEvent.EventDate, DateTimeKind.Utc);
    exsistingEvent.Location = updatedEvent.Location;
    exsistingEvent.IsCompleted = updatedEvent.IsCompleted;
    exsistingEvent.Updated = DateTime.UtcNow;

    await _context.SaveChangesAsync();

    return NoContent();
  }

  [HttpDelete("{id}")]
  public async Task<IActionResult> Delete(int id)
  {
    var eventItem = await _context.Events.FindAsync(id);

    if(eventItem == null) return NotFound();

    _context.Events.Remove(eventItem);
    await _context.SaveChangesAsync();

    return NoContent();
  }
}