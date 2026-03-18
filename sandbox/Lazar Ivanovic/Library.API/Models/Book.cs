namespace Library.API.Models;

// knjiga u katalogu biblioteke
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string ISBN { get; set; } = string.Empty;
    public string Genre { get; set; } = string.Empty;
    
    // koliko ukupno primeraka biblioteka ima
    public int TotalCopies { get; set; }
    
    // koliko je trenutno slobodno - smanjuje se kad neko rezerviše
    public int AvailableCopies { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // sve rezervacije za ovu knjigu
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
