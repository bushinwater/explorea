namespace Library.API.Models;

// rezervacija - veza između korisnika i knjige
public class Reservation
{
    public int Id { get; set; }

    // foreign key - čiji je zahtev
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    // foreign key - koja knjiga
    public int BookId { get; set; }
    public Book Book { get; set; } = null!;

    // pending = čeka odobrenje, approved = pozajmljeno,
    // returned = vraćeno, cancelled = otkazano
    public string Status { get; set; } = "pending";

    public DateTime ReservedAt { get; set; } = DateTime.UtcNow;
    
    // kada ističe rezervacija ako je ne preuzme
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(3);
    
    // kada je admin odobrio i korisnik preuzeo
    public DateTime? BorrowedAt { get; set; }
    
    // kada je knjiga vraćena
    public DateTime? ReturnedAt { get; set; }
}