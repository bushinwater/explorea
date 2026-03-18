import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../shared/services/api.service';
import { Workout } from '../../shared/models/models';

@Component({
  selector: 'app-workout-log',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './workout-log.component.html',
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
