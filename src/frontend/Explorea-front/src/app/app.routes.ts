import { Routes } from '@angular/router';
import { Interests } from './features/auth/interests/interests';
import { Settings } from './features/profile/settings/settings';

export const routes: Routes = [
  { path: 'interests', component: Interests },
  { path: 'profile', component: Settings },
];
