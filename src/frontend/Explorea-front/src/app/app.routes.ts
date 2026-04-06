import { Routes } from '@angular/router';
import { Interests } from './features/auth/interests/interests';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Home } from './features/home/home';
import { Settings } from './features/profile/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' }, //to-do dodati guardove malo kasnije
  { path: 'home', component: Home },
  { path: 'interests', component: Interests },
  { path: 'profile', component: Settings },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
];
