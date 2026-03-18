import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExerciseService } from '../../shared/services/api.service';
import { Exercise } from '../../shared/models/models';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-exercises.component.html',
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
