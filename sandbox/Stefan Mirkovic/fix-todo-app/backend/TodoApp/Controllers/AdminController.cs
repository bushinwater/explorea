using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApp.Data;
using TodoApp.DTOs;
using TodoApp.Models;

namespace TodoApp.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(AppDbContext db, UserManager<AppUser> userManager) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalUsers = await db.Users.CountAsync();
        var totalTodos = await db.TodoItems.CountAsync();
        var completedTodos = await db.TodoItems.CountAsync(t => t.IsCompleted);
        var predefinedTasks = await db.PredefinedTasks.CountAsync();

        return Ok(new AdminStatsResponse(totalUsers, totalTodos, completedTodos, predefinedTasks));
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await db.Users
            .Include(u => u.TodoItems)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        var result = new List<UserAdminResponse>();
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            result.Add(new UserAdminResponse(
                user.Id,
                user.Email!,
                user.FullName,
                roles.FirstOrDefault() ?? "User",
                user.CreatedAt,
                user.TodoItems.Count
            ));
        }

        return Ok(result);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        await userManager.DeleteAsync(user);
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

    [HttpPost("predefined")]
    public async Task<IActionResult> CreatePredefined(CreatePredefinedTaskRequest req)
    {
        var task = new PredefinedTask
        {
            Title = req.Title,
            Description = req.Description
        };

        db.PredefinedTasks.Add(task);
        await db.SaveChangesAsync();

        return Ok(new PredefinedTaskResponse(task.Id, task.Title, task.Description, task.CreatedAt));
    }

    [HttpDelete("predefined/{id}")]
    public async Task<IActionResult> DeletePredefined(int id)
    {
        var task = await db.PredefinedTasks.FindAsync(id);
        if (task == null) return NotFound();

        db.PredefinedTasks.Remove(task);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
