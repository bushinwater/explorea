export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  role: string;
  name: string;
  userId: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string;
  description: string;
}

export interface WorkoutExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  weightKg: number;
}

export interface Workout {
  id: number;
  date: string;
  notes?: string;
  durationMinutes: number;
  exercises: WorkoutExercise[];
}

export interface CreateWorkout {
  date: string;
  notes?: string;
  durationMinutes: number;
  exercises: { exerciseId: number; sets: number; reps: number; weightKg: number }[];
}

export interface BodyStat {
  id: number;
  date: string;
  weightKg: number;
  notes?: string;
}

export interface StatsSummary {
  totalWorkouts: number;
  totalExercises: number;
  lastWeight?: number;
  mostTrainedMuscle?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalWorkouts: number;
  totalExercises: number;
}

export interface UserAdmin {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  workoutCount: number;
}
