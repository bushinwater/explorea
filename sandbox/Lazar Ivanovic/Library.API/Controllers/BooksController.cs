using Library.API.DTOs;
using Library.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Library.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly BookService _bookService;

    public BooksController(BookService bookService)
    {
        _bookService = bookService;
    }

    // GET api/books - svi korisnici vide knjige, čak i bez logovanja
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        // ako je korisnik ulogovan, prosleđujemo njegov ID
        // da bi znali da li ima aktivnu rezervaciju
        var korisnikIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? korisnikId = korisnikIdStr != null ? int.Parse(korisnikIdStr) : null;

        var knjige = await _bookService.GetAll(korisnikId);
        return Ok(knjige);
    }

    // GET api/books/search?pojam=tolkien
    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<IActionResult> Search([FromQuery] string pojam)
    {
        if (string.IsNullOrWhiteSpace(pojam))
            return BadRequest(new { poruka = "Unesite pojam za pretragu." });

        var korisnikIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? korisnikId = korisnikIdStr != null ? int.Parse(korisnikIdStr) : null;

        var knjige = await _bookService.Search(pojam, korisnikId);
        return Ok(knjige);
    }

    // POST api/books - samo admin može da dodaje knjige
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(CreateBookRequest zahtev)
    {
        var knjiga = await _bookService.Create(zahtev);
        return Ok(knjiga);
    }

    // PUT api/books/5 - samo admin može da menja knjige
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, CreateBookRequest zahtev)
    {
        var (uspeh, poruka, knjiga) = await _bookService.Update(id, zahtev);
        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(knjiga);
    }

    // DELETE api/books/5 - samo admin može da briše knjige
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var (uspeh, poruka) = await _bookService.Delete(id);
        if (!uspeh)
            return BadRequest(new { poruka });

        return Ok(new { poruka });
    }
}