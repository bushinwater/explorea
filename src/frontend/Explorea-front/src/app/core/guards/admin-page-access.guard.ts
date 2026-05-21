import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminRole } from '../../features/admin/core/models/admin.models';
import { DashboardAuthService } from '../../features/admin/core/services/dashboard-auth.service';

const ADMIN_PAGE_ROLES: Record<string, AdminRole[]> = {
  dashboard: ['super_admin', 'tourist_organization', 'place_owner'],
  'map-view': ['super_admin', 'tourist_organization'],
  destinations: ['super_admin', 'tourist_organization'],
  events: ['super_admin', 'tourist_organization'],
  activities: ['super_admin', 'tourist_organization'],
  places: ['super_admin', 'tourist_organization', 'place_owner'],
  'activity-log': ['super_admin'],
  'notifications/broadcast': ['super_admin', 'tourist_organization'],
  reviews: ['super_admin', 'tourist_organization', 'place_owner'],
  'object-requests/:id': ['super_admin', 'tourist_organization'],
  reports: ['super_admin', 'tourist_organization'],
  settings: ['super_admin', 'tourist_organization', 'place_owner'],
  support: ['super_admin', 'tourist_organization', 'place_owner'],
  users: ['super_admin'],
};

export const adminPageAccessGuard: CanActivateFn = (route) => {
  const auth = inject(DashboardAuthService);
  const router = inject(Router);
  const routePath = route.routeConfig?.path ?? '';
  const allowedRoles = ADMIN_PAGE_ROLES[routePath];

  auth.syncRoleFromJwt();

  if (!allowedRoles || allowedRoles.includes(auth.role())) {
    return true;
  }

  return router.createUrlTree(['/admin/dashboard']);
};
