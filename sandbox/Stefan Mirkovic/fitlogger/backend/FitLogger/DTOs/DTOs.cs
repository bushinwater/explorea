namespace FitLogger.DTOs;

// Auth
public record RegisterDto(string Email, string Password, string Name);
public record LoginDto(string Email, string Password);
public record AuthResponseDto(string Token, string Role, string Name, int UserId);

// Exercises
public record ExerciseDto(int Id, string Name, string MuscleGroup, string Description);
public record CreateExerciseDto(string Name, string MuscleGroup, string Description);

// Workouts
public record WorkoutExerciseInputDto(int ExerciseId, int Sets, int Reps, decimal WeightKg);
public record CreateWorkoutDto(DateTime Date, string? Notes, int DurationMinutes, List<WorkoutExerciseInputDto> Exercises);

public record WorkoutExerciseDto(int Id, int ExerciseId, string ExerciseName, string MuscleGroup, int Sets, int Reps, decimal WeightKg);
public record WorkoutDto(int Id, DateTime Date, string? Notes, int DurationMinutes, List<WorkoutExerciseDto> Exercises);

// Body stats
public record CreateBodyStatDto(decimal WeightKg, string? Notes);
public record BodyStatDto(int Id, DateTime Date, decimal WeightKg, string? Notes);

// Stats summary
public record StatsSummaryDto(int TotalWorkouts, int TotalExercises, decimal? LastWeight, string? MostTrainedMuscle);

// Admin
public record UserAdminDto(int Id, string Email, string Name, string Role, DateTime CreatedAt, int WorkoutCount);
