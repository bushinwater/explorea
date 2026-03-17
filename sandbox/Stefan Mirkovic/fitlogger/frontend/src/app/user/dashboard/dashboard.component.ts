import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { StatsSummary, Workout } from '../../shared/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Zdravo, {{ auth.userName() }}! 👋</h1>
        <p class="text-muted">Tvoj fitness pregled</p>
      </div>
      <a routerLink="/workout/new" class="btn-primary">+ Novi trening</a>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid" *ngIf="stats()">
      <div class="stat-card">
        <span class="stat-value">{{ stats()!.totalWorkouts }}</span>
        <span class="stat-label">Ukupno treninga</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats()!.totalExercises }}</span>
        <span class="stat-label">Ukupno vežbi</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats()!.lastWeight ?? '—' }} {{ stats()!.lastWeight ? 'kg' : '' }}</span>
        <span class="stat-label">Poslednja težina</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats()!.mostTrainedMuscle ?? '—' }}</span>
        <span class="stat-label">Najtreniranija grupa</span>
      </div>
    </div>

    <!-- Recent workouts -->
    <div class="section">
      <div class="section-header">
        <h2>Poslednji treninzi</h2>
        <a routerLink="/workouts" class="btn-link">Svi treninzi →</a>
      </div>

      <div *ngIf="loading()" class="loading">Učitavanje...</div>

      <div *ngIf="!loading() && workouts().length === 0" class="empty-state">
        <p>Još nema treninga. <a routerLink="/workout/new">Dodaj prvi trening!</a></p>
      </div>

      <div class="workout-list" *ngIf="!loading()">
        <div class="workout-card" *ngFor="let w of workouts()">
          <div class="workout-card-header">
            <span class="workout-date">{{ w.date | date:'dd.MM.yyyy' }}</span>
            <span class="workout-duration">⏱ {{ w.durationMinutes }} min</span>
          </div>
          <div class="workout-exercises">
            <span class="exercise-tag" *ngFor="let e of w.exercises.slice(0, 4)">{{ e.exerciseName }}</span>
            <span class="exercise-tag more" *ngIf="w.exercises.length > 4">+{{ w.exercises.length - 4 }}</span>
          </div>
          <p class="workout-notes" *ngIf="w.notes">{{ w.notes }}</p>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  stats = signal<StatsSummary | null>(null);
  loading = signal(true);

  constructor(public auth: AuthService, private workoutService: WorkoutService) {}

  ngOnInit() {
    this.workoutService.getWorkouts().subscribe(w => {
      this.workouts.set(w.slice(0, 5));
      this.loading.set(false);
    });
    this.workoutService.getStats().subscribe(s => this.stats.set(s));
  }
}
