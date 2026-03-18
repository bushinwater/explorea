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
  templateUrl: './dashboard.component.html',
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
