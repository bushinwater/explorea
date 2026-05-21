import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import {
  normalizeAdminLandingPage,
} from '../../features/admin/core/admin-landing-pages';
import { DashboardAuthService } from '../../features/admin/core/services/dashboard-auth.service';
import { AdminSettingsService } from '../../features/admin/settings/admin-settings.service';

export const adminDefaultLandingGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(DashboardAuthService);
  const settings = inject(AdminSettingsService);

  auth.syncRoleFromJwt();

  return settings.getPreferences().pipe(
    map((preferences) => {
      const landingPage = normalizeAdminLandingPage(preferences.defaultAdminPage, auth.role());
      return router.createUrlTree([landingPage.route]);
    }),
    catchError(() => of(router.createUrlTree(['/admin/dashboard']))),
  );
};

