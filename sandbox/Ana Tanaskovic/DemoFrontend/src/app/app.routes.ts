import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { PostsComponent } from './components/posts/posts';

export const routes: Routes = [
  { path: 'posts', component: PostsComponent },
  { path: 'login', component: Login },
  { path: '', redirectTo: 'posts', pathMatch: 'full' },
];
