using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FitLogger.Data;
using FitLogger.DTOs;

namespace FitLogger.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminController(AppDbContext db) => _db = db;

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .Include(u => u.Workouts)
            .Select(u => new UserAdminDto(
                u.Id, u.Email, u.Name, u.Role, u.CreatedAt, u.Workouts.Count
            ))
            .ToListAsync();
        return Ok(users);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.Role == "admin") return BadRequest(new { message = "Cannot delete admin." });
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalUsers = await _db.Users.CountAsync(u => u.Role == "user");
        var totalWorkouts = await _db.Workouts.CountAsync();
        var totalExercises = await _db.Exercises.CountAsync();
        return Ok(new { totalUsers, totalWorkouts, totalExercises });
    }
}
