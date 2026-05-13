import { Routes } from '@angular/router';
import { adminUsersAccessGuard } from './core/guards/admin-users-access.guard';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { ActivityDetailComponent } from './features/activities/activity-detail/activity-detail';
import { Dashboard } from './features/admin/dashboard/dashboard';
import { AdminDestinationsPageComponent } from './features/admin/destinations/admin-destinations-page.component';
import { AdminEventsPageComponent } from './features/admin/events/admin-events-page.component';
import { AdminActivitiesPageComponent } from './features/admin/activities/admin-activities-page.component';
import { AdminHomePageComponent } from './features/admin/home/admin-home-page.component';
import { AdminMapViewComponent } from './features/admin/map-view/admin-map-view.component';
import { AdminShellComponent } from './features/admin/layout/admin-shell/admin-shell.component';
import { AdminSupportPageComponent } from './features/admin/support/admin-support-page.component';
import { AdminReviewsPageComponent } from './features/admin/reviews/admin-reviews-page.component';
import { AdminReportsPageComponent } from './features/admin/reports/admin-reports-page.component';
import { AdminSettingsPageComponent } from './features/admin/settings/admin-settings-page.component';
import { UserDirectoryPageComponent } from './features/admin/users/user-directory-page.component';
import { CompleteProfile } from './features/auth/complete-profile/complete-profile';
import { FacebookCallback } from './features/auth/facebook-callback/facebook-callback';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { Interests } from './features/auth/interests/interests';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { DestinationDetailComponent } from './features/destinations/destination-detail/destination-detail';
import { EventDetailComponent } from './features/events/event-detail/event-detail';
import { EventsListPage } from './features/events/events-list/events-list';
import { Explore } from './features/explore/explore';
import { Home } from './features/home/home';
import { PlaceDetailComponent } from './features/places/place-detail/place-detail';
import { SavedItemsPage } from './features/profile/saved-items/saved-items';
import { Settings } from './features/profile/settings/settings';
import { Search } from './features/search/search';

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
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'map-view', component: AdminMapViewComponent },
      { path: 'destinations', component: AdminDestinationsPageComponent },
      { path: 'events', component: AdminEventsPageComponent },
      { path: 'activities', component: AdminActivitiesPageComponent },
      { path: 'reviews', component: AdminReviewsPageComponent },
      {
        path: 'object-requests/:id',
        loadComponent: () =>
          import('./features/admin/object-requests/pages/object-request-detail/object-request-detail').then(
            (m) => m.AdminObjectRequestDetailComponent,
          ),
      },
      { path: 'reports', component: AdminReportsPageComponent },
      { path: 'settings', component: AdminSettingsPageComponent },
      { path: 'support', component: AdminSupportPageComponent },
      {
        path: 'users',
        component: UserDirectoryPageComponent,
        canActivate: [adminUsersAccessGuard],
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
