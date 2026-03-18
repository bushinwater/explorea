using Library.API.Data;
using Library.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Library.API.Services;

public class AuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    // dependency injection - .NET nam automatski ubacuje ove objekte
    public AuthService(AppDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    public async Task<User?> Register(string name, string email, string password, string role = "User")
    {
        // normalizujemo email pre svega - trim i lowercase
        email = email.Trim().ToLower();

        // proverimo da li već postoji korisnik sa tim emailom
        var postojiKorisnik = await _context.Users.AnyAsync(u => u.Email == email);
        if (postojiKorisnik)
            return null;

        var korisnik = new User
        {
            Name = name,
            Email = email,
            // nikad ne čuvamo lozinku kao plain text
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role
        };

        _context.Users.Add(korisnik);
        await _context.SaveChangesAsync();

        return korisnik;
    }

    public async Task<string?> Login(string email, string password)
    {
        email = email.Trim().ToLower();

        // tražimo korisnika po emailu
        var korisnik = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (korisnik == null)
            return null;

        // proveravamo da li se lozinka poklapa sa hash-om u bazi
        var lozinkaOdgovara = BCrypt.Net.BCrypt.Verify(password, korisnik.PasswordHash);
        if (!lozinkaOdgovara)
            return null;

        return GenerisiToken(korisnik);
    }

    private string GenerisiToken(User korisnik)
    {
        // claims su informacije koje pakujemo u token
        // Angular će iz tokena da zna ko je korisnik i koji mu je role
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, korisnik.Id.ToString()),
            new Claim(ClaimTypes.Name, korisnik.Name),
            new Claim(ClaimTypes.Email, korisnik.Email),
            new Claim(ClaimTypes.Role, korisnik.Role)
        };

        var kljuc = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));

        var kredencijali = new SigningCredentials(kljuc, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(
                double.Parse(_config["Jwt:ExpiresInHours"]!)),
            signingCredentials: kredencijali
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    
    // pomoćna metoda da izvučemo korisnika po emailu
    public async Task<User?> GetByEmail(string email)
    {
        email = email.Trim().ToLower();
        return await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
    }

}