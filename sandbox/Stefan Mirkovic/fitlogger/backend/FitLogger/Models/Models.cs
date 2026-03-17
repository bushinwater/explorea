namespace FitLogger.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "user"; // "user" or "admin"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Workout> Workouts { get; set; } = new List<Workout>();
    public ICollection<BodyStat> BodyStats { get; set; } = new List<BodyStat>();
}

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string MuscleGroup { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WorkoutExercise> WorkoutExercises { get; set; } = new List<WorkoutExercise>();
}

public class Workout
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public int DurationMinutes { get; set; }

    public ICollection<WorkoutExercise> WorkoutExercises { get; set; } = new List<WorkoutExercise>();
}

public class WorkoutExercise
{
    public int Id { get; set; }
    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public decimal WeightKg { get; set; }
}

public class BodyStat
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public decimal WeightKg { get; set; }
    public string? Notes { get; set; }
}
