import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../shared/services/api.service';
import { AdminStats } from '../../shared/models/models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Admin Panel</h1>
        <p class="text-muted">Pregled sistema</p>
      </div>
    </div>

    <div class="stats-grid" *ngIf="stats()">
      <div class="stat-card stat-card-admin">
        <span class="stat-value">{{ stats()!.totalUsers }}</span>
        <span class="stat-label">Registrovani korisnici</span>
      </div>
      <div class="stat-card stat-card-admin">
        <span class="stat-value">{{ stats()!.totalWorkouts }}</span>
        <span class="stat-label">Ukupno treninga</span>
      </div>
      <div class="stat-card stat-card-admin">
        <span class="stat-value">{{ stats()!.totalExercises }}</span>
        <span class="stat-label">Vežbi u katalogu</span>
      </div>
    </div>

    <div class="admin-nav">
      <a routerLink="/admin/users" class="admin-nav-card">
        <span class="admin-nav-icon">👥</span>
        <span>Upravljanje korisnicima</span>
      </a>
      <a routerLink="/admin/exercises" class="admin-nav-card">
        <span class="admin-nav-icon">🏋️</span>
        <span>Upravljanje vežbama</span>
      </a>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  stats = signal<AdminStats | null>(null);

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getStats().subscribe(s => this.stats.set(s));
  }
}
