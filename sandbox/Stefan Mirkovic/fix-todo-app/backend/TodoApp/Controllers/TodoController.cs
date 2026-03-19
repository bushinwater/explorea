using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TodoApp.Data;
using TodoApp.DTOs;
using TodoApp.Models;

namespace TodoApp.Controllers;

[ApiController]
[Route("api/todos")]
[Authorize]
public class TodoController(AppDbContext db) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await db.TodoItems
            .Where(t => t.UserId == UserId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TodoResponse(t.Id, t.Title, t.Description, t.IsCompleted, t.CreatedAt, t.CompletedAt))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateTodoRequest req)
    {
        var item = new TodoItem
        {
            Title = req.Title,
            Description = req.Description,
            UserId = UserId
        };

        db.TodoItems.Add(item);
        await db.SaveChangesAsync();

        return Ok(new TodoResponse(item.Id, item.Title, item.Description, item.IsCompleted, item.CreatedAt, item.CompletedAt));
    }

    [HttpPatch("{id}/toggle")]
    public async Task<IActionResult> Toggle(int id)
    {
        var item = await db.TodoItems.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
        if (item == null) return NotFound();

        item.IsCompleted = !item.IsCompleted;
        item.CompletedAt = item.IsCompleted ? DateTime.UtcNow : null;

        await db.SaveChangesAsync();
        return Ok(new TodoResponse(item.Id, item.Title, item.Description, item.IsCompleted, item.CreatedAt, item.CompletedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await db.TodoItems.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
        if (item == null) return NotFound();

        db.TodoItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("predefined")]
    public async Task<IActionResult> GetPredefined()
    {
        var tasks = await db.PredefinedTasks
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new PredefinedTaskResponse(t.Id, t.Title, t.Description, t.CreatedAt))
            .ToListAsync();

        return Ok(tasks);
    }
}
