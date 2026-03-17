import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkoutService, ExerciseService } from '../../shared/services/api.service';
import { Exercise } from '../../shared/models/models';

@Component({
  selector: 'app-workout-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <h1>Novi trening</h1>
    </div>

    <div class="form-card">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="form-row">
          <div class="field">
            <label>Datum</label>
            <input type="date" formControlName="date" />
          </div>
          <div class="field">
            <label>Trajanje (minuti)</label>
            <input type="number" formControlName="durationMinutes" placeholder="60" min="1" />
          </div>
        </div>

        <div class="field">
          <label>Beleške (opciono)</label>
          <textarea formControlName="notes" placeholder="Kako si se osećao..." rows="2"></textarea>
        </div>

        <!-- Exercises -->
        <div class="section-subheader">
          <h3>Vežbe</h3>
          <button type="button" class="btn-secondary" (click)="addExercise()">+ Dodaj vežbu</button>
        </div>

        <div formArrayName="exercises">
          <div class="exercise-row" *ngFor="let ex of exercisesArray.controls; let i = index" [formGroupName]="i">
            <div class="field">
              <label>Vežba</label>
              <select formControlName="exerciseId">
                <option value="">— Izaberi —</option>
                <option *ngFor="let e of exercises()" [value]="e.id">{{ e.name }} ({{ e.muscleGroup }})</option>
              </select>
            </div>
            <div class="field field-sm">
              <label>Serije</label>
              <input type="number" formControlName="sets" placeholder="3" min="1" />
            </div>
            <div class="field field-sm">
              <label>Ponavljanja</label>
              <input type="number" formControlName="reps" placeholder="10" min="1" />
            </div>
            <div class="field field-sm">
              <label>Kg</label>
              <input type="number" formControlName="weightKg" placeholder="80" min="0" step="0.5" />
            </div>
            <button type="button" class="btn-danger-sm remove-btn" (click)="removeExercise(i)">✕</button>
          </div>
        </div>

        <div class="form-error" *ngIf="error">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" (click)="cancel()">Otkaži</button>
          <button type="submit" class="btn-primary" [disabled]="loading()">
            {{ loading() ? 'Čuvanje...' : 'Sačuvaj trening' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class WorkoutFormComponent implements OnInit {
  exercises = signal<Exercise[]>([]);
  loading = signal(false);
  error = '';

  form = this.fb.group({
    date: [new Date().toISOString().split('T')[0], Validators.required],
    durationMinutes: [60, [Validators.required, Validators.min(1)]],
    notes: [''],
    exercises: this.fb.array([]),
  });

  get exercisesArray() {
    return this.form.get('exercises') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.exerciseService.getAll().subscribe(e => this.exercises.set(e));
    this.addExercise();
  }

  addExercise() {
    this.exercisesArray.push(this.fb.group({
      exerciseId: ['', Validators.required],
      sets: [3, [Validators.required, Validators.min(1)]],
      reps: [10, [Validators.required, Validators.min(1)]],
      weightKg: [0, [Validators.required, Validators.min(0)]],
    }));
  }

  removeExercise(i: number) {
    this.exercisesArray.removeAt(i);
  }

  submit() {
    if (this.form.invalid || this.exercisesArray.length === 0) {
      this.error = 'Popuni sva obavezna polja i dodaj bar jednu vežbu.';
      return;
    }
    this.loading.set(true);
    this.error = '';
    const val = this.form.value;
    this.workoutService.createWorkout({
      date: val.date!,
      notes: val.notes || undefined,
      durationMinutes: val.durationMinutes!,
      exercises: val.exercises as any,
    }).subscribe({
      next: () => this.router.navigate(['/workouts']),
      error: () => { this.error = 'Greška pri čuvanju.'; this.loading.set(false); },
    });
  }

  cancel() { this.router.navigate(['/workouts']); }
}
