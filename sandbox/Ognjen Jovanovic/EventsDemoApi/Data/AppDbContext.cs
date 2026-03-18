using EventsDemoApi.Models;
using Microsoft.EntityFrameworkCore;

namespace EventsDemoApi.Data;

public class AppDbContext : DbContext{
  public AppDbContext(DbContextOptions<AppDbContext> options) : base(options){}

  public DbSet<Event> Events => Set<Event>();

  protected override void OnModelCreating(ModelBuilder modelBuilder){
    modelBuilder.Entity<Event>(entity => {
      entity.ToTable("events");

      entity.HasKey(e => e.Id);

      entity.Property(e => e.Title).IsRequired().HasMaxLength(255);

      entity.Property(e => e.Description);

      entity.Property(e => e.EventDate).IsRequired();

      entity.Property(e => e.Location).HasMaxLength(255);

      entity.Property(e => e.IsCompleted).HasDefaultValue(false);

      entity.Property(e => e.Created).HasDefaultValueSql("CURRENT_TIMESTAMP");

      entity.Property(e => e.Updated).HasDefaultValueSql("CURRENT_TIMESTAMP");
    });
  }
}