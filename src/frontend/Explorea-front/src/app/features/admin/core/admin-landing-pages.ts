import { AdminRole } from './models/admin.models';

export interface AdminLandingPageOption {
  value: string;
  label: string;
  route: string;
  roles: AdminRole[];
}

export const ADMIN_LANDING_PAGE_OPTIONS: AdminLandingPageOption[] = [
  {
    value: 'dashboard',
    label: 'Dashboard',
    route: '/admin/dashboard',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'map-view',
    label: 'Mapa',
    route: '/admin/map-view',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'destinations',
    label: 'Destinacije',
    route: '/admin/destinations',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'events',
    label: 'Dogadjaji',
    route: '/admin/events',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'activities',
    label: 'Aktivnosti',
    route: '/admin/activities',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'activity-log',
    label: 'Audit log',
    route: '/admin/activity-log',
    roles: ['super_admin'],
  },
  {
    value: 'notifications-broadcast',
    label: 'Broadcast obavestenje',
    route: '/admin/notifications/broadcast',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'reviews',
    label: 'Recenzije',
    route: '/admin/reviews',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'users',
    label: 'Korisnici',
    route: '/admin/users',
    roles: ['super_admin'],
  },
  {
    value: 'reports',
    label: 'Izvestaji',
    route: '/admin/reports',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'support',
    label: 'Podrska',
    route: '/admin/support',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'settings',
    label: 'Podesavanja',
    route: '/admin/settings',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
];

export function adminLandingPagesForRole(role: AdminRole): AdminLandingPageOption[] {
  return ADMIN_LANDING_PAGE_OPTIONS.filter((option) => option.roles.includes(role));
}

export function normalizeAdminLandingPage(value: string, role: AdminRole): AdminLandingPageOption {
  const options = adminLandingPagesForRole(role);
  return options.find((option) => option.value === value) ?? options[0];
}
