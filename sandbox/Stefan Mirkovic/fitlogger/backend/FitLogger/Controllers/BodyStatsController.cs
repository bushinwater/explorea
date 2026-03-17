using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FitLogger.Data;
using FitLogger.DTOs;
using FitLogger.Models;

namespace FitLogger.Controllers;

[ApiController]
[Route("api/bodystats")]
[Authorize]
public class BodyStatsController : ControllerBase
{
    private readonly AppDbContext _db;
    public BodyStatsController(AppDbContext db) => _db = db;

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var stats = await _db.BodyStats
            .Where(b => b.UserId == UserId)
            .OrderByDescending(b => b.Date)
            .Select(b => new BodyStatDto(b.Id, b.Date, b.WeightKg, b.Notes))
            .ToListAsync();
        return Ok(stats);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateBodyStatDto dto)
    {
        var stat = new BodyStat
        {
            UserId = UserId,
            WeightKg = dto.WeightKg,
            Notes = dto.Notes
        };
        _db.BodyStats.Add(stat);
        await _db.SaveChangesAsync();
        return Created("", new BodyStatDto(stat.Id, stat.Date, stat.WeightKg, stat.Notes));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var stat = await _db.BodyStats.FirstOrDefaultAsync(b => b.Id == id && b.UserId == UserId);
        if (stat == null) return NotFound();
        _db.BodyStats.Remove(stat);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
