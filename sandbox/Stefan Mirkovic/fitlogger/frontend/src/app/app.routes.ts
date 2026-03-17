import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './shared/guards/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Auth (guest only)
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard],
  },

  // User area
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./user/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'workouts',
        loadComponent: () => import('./user/workout-log/workout-log.component').then(m => m.WorkoutLogComponent),
      },
      {
        path: 'workout/new',
        loadComponent: () => import('./user/workout-form/workout-form.component').then(m => m.WorkoutFormComponent),
      },
      {
        path: 'body-stats',
        loadComponent: () => import('./user/body-stats/body-stats.component').then(m => m.BodyStatsComponent),
      },

      // Admin area
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
          },
          {
            path: 'users',
            loadComponent: () => import('./admin/users/admin-users.component').then(m => m.AdminUsersComponent),
          },
          {
            path: 'exercises',
            loadComponent: () => import('./admin/exercises/admin-exercises.component').then(m => m.AdminExercisesComponent),
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
