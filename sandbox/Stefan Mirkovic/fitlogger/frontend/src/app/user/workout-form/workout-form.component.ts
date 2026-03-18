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
  templateUrl: './workout-form.component.html',
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
