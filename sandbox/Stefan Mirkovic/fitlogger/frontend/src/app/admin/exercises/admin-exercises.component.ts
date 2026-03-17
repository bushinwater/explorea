import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExerciseService } from '../../shared/services/api.service';
import { Exercise } from '../../shared/models/models';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <h1>Katalog vežbi</h1>
    </div>

    <div class="two-col">
      <div class="form-card">
        <h3>Dodaj vežbu</h3>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Naziv</label>
            <input type="text" formControlName="name" placeholder="Bench Press" />
          </div>
          <div class="field">
            <label>Mišićna grupa</label>
            <select formControlName="muscleGroup">
              <option value="">— Izaberi —</option>
              <option>Chest</option><option>Back</option><option>Legs</option>
              <option>Shoulders</option><option>Arms</option><option>Core</option><option>Cardio</option>
            </select>
          </div>
          <div class="field">
            <label>Opis</label>
            <textarea formControlName="description" rows="2" placeholder="Kratak opis vežbe..."></textarea>
          </div>
          <div class="form-success" *ngIf="success">Vežba dodata!</div>
          <div class="form-error" *ngIf="error">{{ error }}</div>
          <button type="submit" class="btn-primary" [disabled]="loading()">Dodaj</button>
        </form>
      </div>

      <div>
        <div *ngIf="fetchLoading()" class="loading">Učitavanje...</div>
        <div class="exercise-admin-row" *ngFor="let e of exercises()">
          <div>
            <strong>{{ e.name }}</strong>
            <span class="muscle-badge">{{ e.muscleGroup }}</span>
            <p class="text-muted">{{ e.description }}</p>
          </div>
          <button class="btn-danger-sm" (click)="delete(e)">Obriši</button>
        </div>
      </div>
    </div>
  `,
})
export class AdminExercisesComponent implements OnInit {
  exercises = signal<Exercise[]>([]);
  loading = signal(false);
  fetchLoading = signal(true);
  success = false;
  error = '';

  form = this.fb.group({
    name: ['', Validators.required],
    muscleGroup: ['', Validators.required],
    description: ['', Validators.required],
  });

  constructor(private fb: FormBuilder, private exerciseService: ExerciseService) {}

  ngOnInit() {
    this.exerciseService.getAll().subscribe(e => {
      this.exercises.set(e);
      this.fetchLoading.set(false);
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error = '';
    const { name, muscleGroup, description } = this.form.value;
    this.exerciseService.create(name!, muscleGroup!, description!).subscribe({
      next: (e) => {
        this.exercises.update(arr => [e, ...arr]);
        this.form.reset();
        this.loading.set(false);
        this.success = true;
        setTimeout(() => this.success = false, 2000);
      },
      error: () => { this.error = 'Greška pri dodavanju.'; this.loading.set(false); },
    });
  }

  delete(exercise: Exercise) {
    if (!confirm(`Obrisati "${exercise.name}"?`)) return;
    this.exerciseService.delete(exercise.id).subscribe(() =>
      this.exercises.update(arr => arr.filter(e => e.id !== exercise.id))
    );
  }
}
