import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../shared/services/api.service';
import { Workout } from '../../shared/models/models';

@Component({
  selector: 'app-workout-log',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header">
      <h1>Moji treninzi</h1>
      <a routerLink="/workout/new" class="btn-primary">+ Novi trening</a>
    </div>

    <div *ngIf="loading()" class="loading">Učitavanje...</div>

    <div *ngIf="!loading() && workouts().length === 0" class="empty-state">
      <p>Nema evidentiranih treninga.</p>
      <a routerLink="/workout/new" class="btn-primary">Dodaj trening</a>
    </div>

    <div class="workout-list" *ngIf="!loading()">
      <div class="workout-card" *ngFor="let w of workouts()">
        <div class="workout-card-header">
          <div>
            <span class="workout-date">{{ w.date | date:'EEEE, dd.MM.yyyy' }}</span>
            <span class="workout-duration">⏱ {{ w.durationMinutes }} min</span>
          </div>
          <button class="btn-danger-sm" (click)="delete(w.id)">Obriši</button>
        </div>
        <div class="workout-exercises">
          <span class="exercise-tag" *ngFor="let e of w.exercises">
            {{ e.exerciseName }} — {{ e.sets }}x{{ e.reps }} &#64; {{ e.weightKg }}kg
          </span>
        </div>
        <p class="workout-notes" *ngIf="w.notes">📝 {{ w.notes }}</p>
      </div>
    </div>

    <div class="pagination" *ngIf="!loading() && workouts().length > 0">
      <button class="btn-secondary" (click)="prevPage()" [disabled]="page() === 1">← Prethodni</button>
      <span>Strana {{ page() }}</span>
      <button class="btn-secondary" (click)="nextPage()">Sledeći →</button>
    </div>
  `,
})
export class WorkoutLogComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  loading = signal(true);
  page = signal(1);

  constructor(private workoutService: WorkoutService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.workoutService.getWorkouts(this.page()).subscribe(w => {
      this.workouts.set(w);
      this.loading.set(false);
    });
  }

  delete(id: number) {
    if (!confirm('Obrisati trening?')) return;
    this.workoutService.deleteWorkout(id).subscribe(() => this.load());
  }

  nextPage() { this.page.update(p => p + 1); this.load(); }
  prevPage() { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
}
