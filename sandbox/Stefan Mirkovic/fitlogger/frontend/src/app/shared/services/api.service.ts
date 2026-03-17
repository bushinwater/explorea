import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Exercise, Workout, CreateWorkout, BodyStat, StatsSummary, UserAdmin, AdminStats } from '../models/models';

const BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  constructor(private http: HttpClient) {}

  getWorkouts(page = 1) {
    return this.http.get<Workout[]>(`${BASE}/workouts?page=${page}&pageSize=10`);
  }

  getWorkout(id: number) {
    return this.http.get<Workout>(`${BASE}/workouts/${id}`);
  }

  createWorkout(dto: CreateWorkout) {
    return this.http.post<Workout>(`${BASE}/workouts`, dto);
  }

  deleteWorkout(id: number) {
    return this.http.delete(`${BASE}/workouts/${id}`);
  }

  getStats() {
    return this.http.get<StatsSummary>(`${BASE}/workouts/stats`);
  }
}

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<Exercise[]>(`${BASE}/exercises`);
  }

  create(name: string, muscleGroup: string, description: string) {
    return this.http.post<Exercise>(`${BASE}/exercises`, { name, muscleGroup, description });
  }

  delete(id: number) {
    return this.http.delete(`${BASE}/exercises/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class BodyStatService {
  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<BodyStat[]>(`${BASE}/bodystats`);
  }

  create(weightKg: number, notes?: string) {
    return this.http.post<BodyStat>(`${BASE}/bodystats`, { weightKg, notes });
  }

  delete(id: number) {
    return this.http.delete(`${BASE}/bodystats/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  getUsers() {
    return this.http.get<UserAdmin[]>(`${BASE}/admin/users`);
  }

  deleteUser(id: number) {
    return this.http.delete(`${BASE}/admin/users/${id}`);
  }

  getStats() {
    return this.http.get<AdminStats>(`${BASE}/admin/stats`);
  }
}
