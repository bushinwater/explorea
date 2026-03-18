using Library.API.Data;
using Library.API.DTOs;
using Library.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Library.API.Services;

public class ReservationService
{
    private readonly AppDbContext _context;

    public ReservationService(AppDbContext context)
    {
        _context = context;
    }

    // korisnik rezerviše knjigu
    public async Task<(bool Uspeh, string Poruka, Reservation? Rezervacija)> Create(int korisnikId, int knjigaId)
    {
        var knjiga = await _context.Books.FindAsync(knjigaId);
        if (knjiga == null)
            return (false, "Knjiga nije pronađena.", null);

        // ne može da rezerviše ako nema slobodnih primeraka
        if (knjiga.AvailableCopies <= 0)
            return (false, "Nema slobodnih primeraka.", null);

        // ne može ista osoba dva puta da rezerviše istu knjigu
        var postojiRezervacija = await _context.Reservations
            .AnyAsync(r => r.UserId == korisnikId &&
                           r.BookId == knjigaId &&
                           (r.Status == "pending" || r.Status == "approved"));

        if (postojiRezervacija)
            return (false, "Već imate aktivnu rezervaciju za ovu knjigu.", null);

        // smanjujemo broj slobodnih primeraka
        knjiga.AvailableCopies--;

        var rezervacija = new Reservation
        {
            UserId = korisnikId,
            BookId = knjigaId,
            Status = "pending",
            ReservedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(3)
        };

        _context.Reservations.Add(rezervacija);
        await _context.SaveChangesAsync();

        return (true, "Rezervacija uspešno kreirana.", rezervacija);
    }

    // korisnik otkazuje svoju rezervaciju
    public async Task<(bool Uspeh, string Poruka)> Cancel(int rezervacijaId, int korisnikId)
    {
        var rezervacija = await _context.Reservations
            .Include(r => r.Book)
            .FirstOrDefaultAsync(r => r.Id == rezervacijaId);

        if (rezervacija == null)
            return (false, "Rezervacija nije pronađena.");

        // korisnik može da otkaže samo svoju rezervaciju
        if (rezervacija.UserId != korisnikId)
            return (false, "Nemate dozvolu za ovu akciju.");

        // ne može da otkaže ako je knjiga već vraćena ili otkazana
        if (rezervacija.Status == "returned" || rezervacija.Status == "cancelled")
            return (false, "Ova rezervacija je već zatvorena.");

        rezervacija.Status = "cancelled";

        // vraćamo primerak u slobodne
        rezervacija.Book.AvailableCopies++;

        await _context.SaveChangesAsync();

        return (true, "Rezervacija otkazana.");
    }

    // korisnik vidi svoje rezervacije
    public async Task<List<ReservationResponse>> GetForUser(int korisnikId)
    {
        return await _context.Reservations
            .Include(r => r.Book)
            .Where(r => r.UserId == korisnikId)
            .OrderByDescending(r => r.ReservedAt)
            .Select(r => new ReservationResponse
            {
                Id = r.Id,
                BookId = r.BookId,
                BookTitle = r.Book.Title,
                BookAuthor = r.Book.Author,
                Status = r.Status,
                ReservedAt = r.ReservedAt,
                ExpiresAt = r.ExpiresAt,
                BorrowedAt = r.BorrowedAt,
                ReturnedAt = r.ReturnedAt
            })
            .ToListAsync();
    }

    // admin vidi sve rezervacije
    public async Task<List<AdminReservationResponse>> GetAll()
    {
        return await _context.Reservations
            .Include(r => r.Book)
            .Include(r => r.User)
            .OrderByDescending(r => r.ReservedAt)
            .Select(r => new AdminReservationResponse
            {
                Id = r.Id,
                BookId = r.BookId,
                BookTitle = r.Book.Title,
                UserId = r.UserId,
                UserName = r.User.Name,
                UserEmail = r.User.Email,
                Status = r.Status,
                ReservedAt = r.ReservedAt,
                ExpiresAt = r.ExpiresAt,
                BorrowedAt = r.BorrowedAt,
                ReturnedAt = r.ReturnedAt
            })
            .ToListAsync();
    }

    // admin odobrava rezervaciju - korisnik je preuzeo knjigu
    public async Task<(bool Uspeh, string Poruka)> Approve(int rezervacijaId)
    {
        var rezervacija = await _context.Reservations
            .FirstOrDefaultAsync(r => r.Id == rezervacijaId);

        if (rezervacija == null)
            return (false, "Rezervacija nije pronađena.");

        if (rezervacija.Status != "pending")
            return (false, "Samo pending rezervacije mogu biti odobrene.");

        rezervacija.Status = "approved";
        rezervacija.BorrowedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return (true, "Rezervacija odobrena.");
    }

    // admin evidentira povratak knjige
    public async Task<(bool Uspeh, string Poruka)> Return(int rezervacijaId)
    {
        var rezervacija = await _context.Reservations
            .Include(r => r.Book)
            .FirstOrDefaultAsync(r => r.Id == rezervacijaId);

        if (rezervacija == null)
            return (false, "Rezervacija nije pronađena.");

        if (rezervacija.Status != "approved")
            return (false, "Samo pozajmljene knjige mogu biti vraćene.");

        rezervacija.Status = "returned";
        rezervacija.ReturnedAt = DateTime.UtcNow;

        // vraćamo primerak u slobodne
        rezervacija.Book.AvailableCopies++;

        await _context.SaveChangesAsync();

        return (true, "Knjiga uspešno vraćena.");
    }
}