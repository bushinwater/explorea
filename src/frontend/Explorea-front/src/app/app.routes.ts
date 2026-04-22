import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { adminUsersAccessGuard } from './core/guards/admin-users-access.guard';
import { AdminShellComponent } from './features/admin/layout/admin-shell/admin-shell.component';
import { AdminHomePageComponent } from './features/admin/home/admin-home-page.component';
import { UserDirectoryPageComponent } from './features/admin/users/user-directory-page.component';
import { Dashboard } from './features/admin/dashboard/dashboard';
import { ActivityDetailComponent } from './features/activities/activity-detail/activity-detail';
import { EventDetailComponent } from './features/events/event-detail/event-detail';
import { PlaceDetailComponent } from './features/places/place-detail/place-detail';
import { DestinationDetailComponent } from './features/destinations/destination-detail/destination-detail';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { Interests } from './features/auth/interests/interests';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { CompleteProfile } from './features/auth/complete-profile/complete-profile';
import { FacebookCallback } from './features/auth/facebook-callback/facebook-callback';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { Home } from './features/home/home';
import { Explore } from './features/explore/explore';
import { Search } from './features/search/search';
import { Settings } from './features/profile/settings/settings';
import { SavedItemsPage } from './features/profile/saved-items/saved-items';
import { EventsListPage } from './features/events/events-list/events-list';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'explore', component: Explore },
  { path: 'search', component: Search },
  { path: 'events', component: EventsListPage },
  { path: 'activities/:slug', component: ActivityDetailComponent },
  { path: 'events/:slug', component: EventDetailComponent },
  { path: 'places/:slug', component: PlaceDetailComponent },
  { path: 'destinations/:slug', component: DestinationDetailComponent },
  { path: 'interests', component: Interests, canActivate: [authGuard] },
  { path: 'profile', component: Settings, canActivate: [authGuard] },
  { path: 'saved', component: SavedItemsPage, canActivate: [authGuard] },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'complete-profile', component: CompleteProfile },
  { path: 'auth/facebook/callback', component: FacebookCallback },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'map-view', component: AdminHomePageComponent },
      { path: 'destinations', component: AdminHomePageComponent },
      { path: 'reviews', component: AdminHomePageComponent },
      { path: 'reports', component: AdminHomePageComponent },
      { path: 'settings', component: AdminHomePageComponent },
      { path: 'users', component: UserDirectoryPageComponent, canActivate: [adminUsersAccessGuard] },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
