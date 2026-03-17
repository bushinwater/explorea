using Microsoft.EntityFrameworkCore;
using FitLogger.Models;

namespace FitLogger.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<Workout> Workouts => Set<Workout>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<BodyStat> BodyStats => Set<BodyStat>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<WorkoutExercise>()
            .Property(w => w.WeightKg)
            .HasPrecision(6, 2);

        modelBuilder.Entity<BodyStat>()
            .Property(b => b.WeightKg)
            .HasPrecision(5, 2);

        // Seed exercises — fiksiran datum da se ne menja pri svakom pokretanju
        var seedDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        modelBuilder.Entity<Exercise>().HasData(
            new Exercise { Id = 1, Name = "Bench Press", MuscleGroup = "Chest", Description = "Barbell bench press", CreatedAt = seedDate },
            new Exercise { Id = 2, Name = "Squat", MuscleGroup = "Legs", Description = "Barbell back squat", CreatedAt = seedDate },
            new Exercise { Id = 3, Name = "Deadlift", MuscleGroup = "Back", Description = "Conventional deadlift", CreatedAt = seedDate },
            new Exercise { Id = 4, Name = "Pull-up", MuscleGroup = "Back", Description = "Bodyweight pull-up", CreatedAt = seedDate },
            new Exercise { Id = 5, Name = "Overhead Press", MuscleGroup = "Shoulders", Description = "Standing barbell press", CreatedAt = seedDate },
            new Exercise { Id = 6, Name = "Bicep Curl", MuscleGroup = "Arms", Description = "Dumbbell curl", CreatedAt = seedDate }
        );
    }
}
