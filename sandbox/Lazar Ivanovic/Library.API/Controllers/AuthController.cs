using Library.API.DTOs;
using Library.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace Library.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    // POST api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest zahtev)
    {
        var korisnik = await _authService.Register(
            zahtev.Name,
            zahtev.Email,
            zahtev.Password
        );

        if (korisnik == null)
            return BadRequest(new { poruka = "Korisnik sa tim emailom već postoji." });

        return Ok(new { poruka = "Registracija uspešna." });
    }

    // POST api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest zahtev)
    {
        var token = await _authService.Login(zahtev.Email, zahtev.Password);

        if (token == null)
            return Unauthorized(new { poruka = "Pogrešan email ili lozinka." });

        // tražimo korisnika da izvučemo podatke za odgovor
        var korisnik = await _authService.GetByEmail(zahtev.Email);

        return Ok(new LoginResponse
        {
            Token = token,
            Name = korisnik!.Name,
            Email = korisnik.Email,
            Role = korisnik.Role
        });
    }
}