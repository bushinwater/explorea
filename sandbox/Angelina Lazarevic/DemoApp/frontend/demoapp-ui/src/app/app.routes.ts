import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Events } from './pages/events/events';
import { MyRegistration } from './pages/my-registration/my-registration';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { AdminEvents } from './pages/admin-events/admin-events';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'events', component: Events },
  { path: 'my-registrations', component: MyRegistration, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboard, canActivate: [adminGuard] },
  { path: 'admin/events', component: AdminEvents, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'events' }
];