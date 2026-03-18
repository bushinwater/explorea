using Library.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Library.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // svi endpointi ovde zahtevaju login
public class ReservationsController : ControllerBase
{
    private readonly ReservationService _reservationService;

    public ReservationsController(ReservationService reservationService)
    {
        _reservationService = reservationService;
    }

    // GET api/reservations/moje - korisnik vidi svoje rezervacije
    [HttpGet("moje")]
    public async Task<IActionResult> GetMoje()
    {
        var korisnikId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var rezervacije = await _reservationService.GetForUser(korisnikId);
        return Ok(rezervacije);
    }

    // POST api/reservations/5 - korisnik rezerviše knjigu sa ID 5
    [HttpPost("{knjigaId}")]
    public async Task<IActionResult> Create(int knjigaId)
    {
        var korisnikId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var (uspeh, poruka, _) = await _reservationService.Create(korisnikId, knjigaId);

        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(new { poruka });
    }

    // PUT api/reservations/5/cancel - korisnik otkazuje rezervaciju
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var korisnikId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var (uspeh, poruka) = await _reservationService.Cancel(id, korisnikId);

        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(new { poruka });
    }

    // GET api/reservations - samo admin vidi sve rezervacije
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var rezervacije = await _reservationService.GetAll();
        return Ok(rezervacije);
    }

    // PUT api/reservations/5/approve - admin odobrava rezervaciju
    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(int id)
    {
        var (uspeh, poruka) = await _reservationService.Approve(id);

        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(new { poruka });
    }

    // PUT api/reservations/5/return - admin evidentira povratak knjige
    [HttpPut("{id}/return")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Return(int id)
    {
        var (uspeh, poruka) = await _reservationService.Return(id);

        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(new { poruka });
    }
}