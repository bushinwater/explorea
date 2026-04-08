import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { ActivityDetailComponent } from './features/activities/activity-detail/activity-detail';
import { Interests } from './features/auth/interests/interests';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Home } from './features/home/home';
import { Settings } from './features/profile/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'activities/:slug', component: ActivityDetailComponent },
  { path: 'interests', component: Interests },
  { path: 'profile', component: Settings, canActivate: [authGuard] },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
];
