import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout">
      <nav class="sidebar">
        <div class="sidebar-logo">
          <span>💪</span>
          <span>FitLogger</span>
        </div>

        <!-- User nav -->
        <ng-container *ngIf="!auth.isAdmin()">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <span>📊</span> Dashboard
          </a>
          <a routerLink="/workouts" routerLinkActive="active" class="nav-item">
            <span>🏋️</span> Treninzi
          </a>
          <a routerLink="/workout/new" routerLinkActive="active" class="nav-item">
            <span>➕</span> Novi trening
          </a>
          <a routerLink="/body-stats" routerLinkActive="active" class="nav-item">
            <span>⚖️</span> Težina
          </a>
        </ng-container>

        <!-- Admin nav -->
        <ng-container *ngIf="auth.isAdmin()">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="nav-item">
            <span>📊</span> Pregled
          </a>
          <a routerLink="/admin/users" routerLinkActive="active" class="nav-item">
            <span>👥</span> Korisnici
          </a>
          <a routerLink="/admin/exercises" routerLinkActive="active" class="nav-item">
            <span>🏋️</span> Vežbe
          </a>
        </ng-container>

        <div class="sidebar-bottom">
          <div class="user-info">
            <span class="user-avatar">{{ auth.userName()?.charAt(0) }}</span>
            <div>
              <div class="user-name">{{ auth.userName() }}</div>
              <div class="user-role">{{ auth.isAdmin() ? 'Admin' : 'Korisnik' }}</div>
            </div>
          </div>
          <button class="btn-logout" (click)="auth.logout()">Odjava</button>
        </div>
      </nav>

      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  constructor(public auth: AuthService) {}
}
