using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FitLogger.Data;
using FitLogger.DTOs;
using FitLogger.Models;

namespace FitLogger.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly AppDbContext _db;

    public WorkoutsController(AppDbContext db) => _db = db;

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetWorkouts([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var workouts = await _db.Workouts
            .Where(w => w.UserId == UserId)
            .Include(w => w.WorkoutExercises)
                .ThenInclude(we => we.Exercise)
            .OrderByDescending(w => w.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => MapWorkout(w))
            .ToListAsync();

        return Ok(workouts);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetWorkout(int id)
    {
        var workout = await _db.Workouts
            .Where(w => w.Id == id && w.UserId == UserId)
            .Include(w => w.WorkoutExercises)
                .ThenInclude(we => we.Exercise)
            .FirstOrDefaultAsync();

        if (workout == null) return NotFound();
        return Ok(MapWorkout(workout));
    }

    [HttpPost]
    public async Task<IActionResult> CreateWorkout(CreateWorkoutDto dto)
    {
        var workout = new Workout
        {
            UserId = UserId,
            Date = DateTime.SpecifyKind(dto.Date, DateTimeKind.Utc),
            Notes = dto.Notes,
            DurationMinutes = dto.DurationMinutes
        };

        foreach (var e in dto.Exercises)
        {
            workout.WorkoutExercises.Add(new WorkoutExercise
            {
                ExerciseId = e.ExerciseId,
                Sets = e.Sets,
                Reps = e.Reps,
                WeightKg = e.WeightKg
            });
        }

        _db.Workouts.Add(workout);
        await _db.SaveChangesAsync();

        // Reload sa Exercise podacima
        var saved = await _db.Workouts
            .Include(w => w.WorkoutExercises)
                .ThenInclude(we => we.Exercise)
            .FirstAsync(w => w.Id == workout.Id);

        return Created($"/api/workouts/{saved.Id}", MapWorkout(saved));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkout(int id)
    {
        var workout = await _db.Workouts.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (workout == null) return NotFound();
        _db.Workouts.Remove(workout);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var workouts = await _db.Workouts
            .Where(w => w.UserId == UserId)
            .Include(w => w.WorkoutExercises)
                .ThenInclude(we => we.Exercise)
            .ToListAsync();

        var totalWorkouts = workouts.Count;
        var totalExercises = workouts.Sum(w => w.WorkoutExercises.Count);

        var mostTrained = workouts
            .SelectMany(w => w.WorkoutExercises)
            .GroupBy(we => we.Exercise.MuscleGroup)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .FirstOrDefault();

        var lastWeight = await _db.BodyStats
            .Where(b => b.UserId == UserId)
            .OrderByDescending(b => b.Date)
            .Select(b => (decimal?)b.WeightKg)
            .FirstOrDefaultAsync();

        return Ok(new StatsSummaryDto(totalWorkouts, totalExercises, lastWeight, mostTrained));
    }

    private static WorkoutDto MapWorkout(Workout w) => new(
        w.Id, w.Date, w.Notes, w.DurationMinutes,
        w.WorkoutExercises.Select(we => new WorkoutExerciseDto(
            we.Id, we.ExerciseId, we.Exercise.Name, we.Exercise.MuscleGroup,
            we.Sets, we.Reps, we.WeightKg
        )).ToList()
    );
}
