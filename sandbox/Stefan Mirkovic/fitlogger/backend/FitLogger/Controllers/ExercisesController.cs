using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FitLogger.Data;
using FitLogger.DTOs;
using FitLogger.Models;

namespace FitLogger.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExercisesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExercisesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var exercises = await _db.Exercises
            .Select(e => new ExerciseDto(e.Id, e.Name, e.MuscleGroup, e.Description))
            .ToListAsync();
        return Ok(exercises);
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create(CreateExerciseDto dto)
    {
        var exercise = new Exercise
        {
            Name = dto.Name,
            MuscleGroup = dto.MuscleGroup,
            Description = dto.Description
        };
        _db.Exercises.Add(exercise);
        await _db.SaveChangesAsync();
        return Created($"/api/exercises/{exercise.Id}", new ExerciseDto(exercise.Id, exercise.Name, exercise.MuscleGroup, exercise.Description));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var exercise = await _db.Exercises.FindAsync(id);
        if (exercise == null) return NotFound();
        _db.Exercises.Remove(exercise);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
