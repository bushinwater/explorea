namespace Library.API.Models;

// korisnik sistema - može biti običan user ili admin
public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // nikad ne čuvamo lozinku direktno, uvek hash
    public string PasswordHash { get; set; } = string.Empty;

    // "Admin" ili "User"
    public string Role { get; set; } = "User";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // lista rezervacija ovog korisnika (EF će sam da poveže)
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}