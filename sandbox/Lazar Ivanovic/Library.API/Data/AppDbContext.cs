using Library.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Library.API.Data;

// ovo je srce veze između aplikacije i baze
// svaki DbSet ovde = jedna tabela u bazi
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Book> Books { get; set; }
    public DbSet<Reservation> Reservations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // naziv tabela u bazi
        modelBuilder.Entity<User>().ToTable("korisnici");
        modelBuilder.Entity<Book>().ToTable("knjige");
        modelBuilder.Entity<Reservation>().ToTable("rezervacije");

        // rezervacija ima jednog korisnika, korisnik ima više rezervacija
        modelBuilder.Entity<Reservation>()
            .HasOne(r => r.User)
            .WithMany(u => u.Reservations)
            .HasForeignKey(r => r.UserId);

        // rezervacija ima jednu knjigu, knjiga ima više rezervacija
        modelBuilder.Entity<Reservation>()
            .HasOne(r => r.Book)
            .WithMany(b => b.Reservations)
            .HasForeignKey(r => r.BookId);

        // baza sama garantuje jedinstvenost emaila i ISBN-a
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Book>()
            .HasIndex(b => b.ISBN)
            .IsUnique();            
    }
}