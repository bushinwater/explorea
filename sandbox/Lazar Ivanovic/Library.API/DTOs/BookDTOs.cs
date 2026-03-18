using System.ComponentModel.DataAnnotations;

namespace Library.API.DTOs;

public class CreateBookRequest
{
    [Required(ErrorMessage = "Naziv knjige je obavezan.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Autor je obavezan.")]
    public string Author { get; set; } = string.Empty;

    [Required(ErrorMessage = "ISBN je obavezan.")]
    public string ISBN { get; set; } = string.Empty;

    public string Genre { get; set; } = string.Empty;

    [Range(1, 100, ErrorMessage = "Broj primeraka mora biti između 1 i 100.")]
    public int TotalCopies { get; set; }
}

public class BookResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string ISBN { get; set; } = string.Empty;
    public string Genre { get; set; } = string.Empty;
    public int TotalCopies { get; set; }
    public int AvailableCopies { get; set; }
    public bool HasActiveReservation { get; set; }
}