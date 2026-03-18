using Library.API.Data;
using Library.API.DTOs;
using Library.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Library.API.Services;

public class BookService
{
    private readonly AppDbContext _context;

    public BookService(AppDbContext context)
    {
        _context = context;
    }

    // vraća sve knjige - korisnik vidi da li ima slobodnih primeraka
    public async Task<List<BookResponse>> GetAll(int? korisnikId = null)
    {
        var knjige = await _context.Books
            .Include(b => b.Reservations)
            .ToListAsync();

        return knjige.Select(b => new BookResponse
        {
            Id = b.Id,
            Title = b.Title,
            Author = b.Author,
            ISBN = b.ISBN,
            Genre = b.Genre,
            TotalCopies = b.TotalCopies,
            AvailableCopies = b.AvailableCopies,
            // proveravamo da li ovaj korisnik već ima aktivnu rezervaciju
            HasActiveReservation = korisnikId.HasValue && b.Reservations
                .Any(r => r.UserId == korisnikId && 
                     (r.Status == "pending" || r.Status == "approved"))
        }).ToList();
    }

    // pretraga knjiga po naslovu, autoru ili žanru
    public async Task<List<BookResponse>> Search(string pojam, int? korisnikId = null)
    {
        var pojamMalo = pojam.ToLower();

        var knjige = await _context.Books
            .Include(b => b.Reservations)
            .Where(b => b.Title.ToLower().Contains(pojamMalo) ||
                        b.Author.ToLower().Contains(pojamMalo) ||
                        b.Genre.ToLower().Contains(pojamMalo))
            .ToListAsync();

        return knjige.Select(b => new BookResponse
        {
            Id = b.Id,
            Title = b.Title,
            Author = b.Author,
            ISBN = b.ISBN,
            Genre = b.Genre,
            TotalCopies = b.TotalCopies,
            AvailableCopies = b.AvailableCopies,
            HasActiveReservation = korisnikId.HasValue && b.Reservations
                .Any(r => r.UserId == korisnikId &&
                     (r.Status == "pending" || r.Status == "approved"))
        }).ToList();
    }

    public async Task<Book?> GetById(int id)
    {
        return await _context.Books.FindAsync(id);
    }

    // admin dodaje novu knjigu
    public async Task<Book> Create(CreateBookRequest zahtev)
    {
        var knjiga = new Book
        {
            Title = zahtev.Title,
            Author = zahtev.Author,
            ISBN = zahtev.ISBN,
            Genre = zahtev.Genre,
            TotalCopies = zahtev.TotalCopies,
            // na početku su svi primerci slobodni
            AvailableCopies = zahtev.TotalCopies
        };

        _context.Books.Add(knjiga);
        await _context.SaveChangesAsync();

        return knjiga;
    }

    // admin menja podatke o knjizi
    public async Task<(bool Uspeh, string Poruka, Book? Knjiga)> Update(int id, CreateBookRequest zahtev)
    {
        var knjiga = await _context.Books.FindAsync(id);
        if (knjiga == null)
            return (false, "Knjiga nije pronađena.", null);

        // koliko je primeraka trenutno zauzeto (rezervisano ili pozajmljeno)
        var zauzeto = knjiga.TotalCopies - knjiga.AvailableCopies;

        if (zahtev.TotalCopies < zauzeto)
            return (false, $"Ne možete smanjiti broj primeraka ispod {zauzeto} jer toliko ima aktivnih rezervacija.", null);

        knjiga.Title = zahtev.Title;
        knjiga.Author = zahtev.Author;
        knjiga.ISBN = zahtev.ISBN;
        knjiga.Genre = zahtev.Genre;
        knjiga.TotalCopies = zahtev.TotalCopies;
        knjiga.AvailableCopies = zahtev.TotalCopies - zauzeto;

        await _context.SaveChangesAsync();

        return (true, "Knjiga uspešno izmenjena.", knjiga);
    }

    // admin briše knjigu
    public async Task<(bool Uspeh, string Poruka)> Delete(int id)
    {
        var knjiga = await _context.Books
            .Include(b => b.Reservations)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (knjiga == null)
            return (false, "Knjiga nije pronađena.");

        // ne dozvoljavamo brisanje ako postoje aktivne rezervacije
        var aktivneRezervacije = knjiga.Reservations
            .Any(r => r.Status == "pending" || r.Status == "approved");

        if (aktivneRezervacije)
            return (false, "Ne možete obrisati knjigu koja ima aktivne rezervacije.");

        _context.Books.Remove(knjiga);
        await _context.SaveChangesAsync();

        return (true, "Knjiga obrisana.");
    }
}