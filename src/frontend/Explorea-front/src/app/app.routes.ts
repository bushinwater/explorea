import { Routes } from '@angular/router';
import { Interests } from './features/auth/interests/interests';
import { Settings } from './features/profile/settings/settings';
import { Home } from './features/home/home';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'interests', component: Interests },
  { path: 'profile', component: Settings },
];
