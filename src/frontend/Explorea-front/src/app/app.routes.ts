import { Routes } from '@angular/router';
import { adminUsersAccessGuard } from './core/guards/admin-users-access.guard';
import { adminDefaultLandingGuard } from './core/guards/admin-default-landing.guard';
import { adminGuard } from './core/guards/admin.guard';
import { adminPageAccessGuard } from './core/guards/admin-page-access.guard';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { ActivityDetailComponent } from './features/activities/activity-detail/activity-detail';
import { AdminActivitiesPageComponent } from './features/admin/activities/admin-activities-page.component';
import { AdminActivityLogPageComponent } from './features/admin/activity-log/admin-activity-log-page.component';
import { Dashboard } from './features/admin/dashboard/dashboard';
import { AdminDestinationsPageComponent } from './features/admin/destinations/admin-destinations-page.component';
import { AdminEventsPageComponent } from './features/admin/events/admin-events-page.component';
import { AdminShellComponent } from './features/admin/layout/admin-shell/admin-shell.component';
import { AdminMapViewComponent } from './features/admin/map-view/admin-map-view.component';
import { AdminBroadcastNotificationPageComponent } from './features/admin/notifications/admin-broadcast-notification-page.component';
import { AdminPlacesPageComponent } from './features/admin/places/admin-places-page.component';
import { AdminReportsPageComponent } from './features/admin/reports/admin-reports-page.component';
import { AdminReviewsPageComponent } from './features/admin/reviews/admin-reviews-page.component';
import { AdminSettingsPageComponent } from './features/admin/settings/admin-settings-page.component';
import { AdminSupportPageComponent } from './features/admin/support/admin-support-page.component';
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
      { path: '', pathMatch: 'full', component: Dashboard, canActivate: [adminDefaultLandingGuard] },
      { path: 'dashboard', component: Dashboard, canActivate: [adminPageAccessGuard] },
      { path: 'map-view', component: AdminMapViewComponent, canActivate: [adminPageAccessGuard] },
      { path: 'destinations', component: AdminDestinationsPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'events', component: AdminEventsPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'activities', component: AdminActivitiesPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'places', component: AdminPlacesPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'activity-log', component: AdminActivityLogPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'notifications/broadcast', component: AdminBroadcastNotificationPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'reviews', component: AdminReviewsPageComponent, canActivate: [adminPageAccessGuard] },
      {
        path: 'object-requests/:id',
        loadComponent: () =>
          import('./features/admin/object-requests/pages/object-request-detail/object-request-detail').then(
            (m) => m.AdminObjectRequestDetailComponent,
          ),
        canActivate: [adminPageAccessGuard],
      },
      { path: 'reports', component: AdminReportsPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'settings', component: AdminSettingsPageComponent, canActivate: [adminPageAccessGuard] },
      { path: 'support', component: AdminSupportPageComponent, canActivate: [adminPageAccessGuard] },
      {
        path: 'users',
        component: UserDirectoryPageComponent,
        canActivate: [adminPageAccessGuard, adminUsersAccessGuard],
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
