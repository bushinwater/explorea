import { AdminRole } from './models/admin.models';

export interface AdminLandingPageOption {
  value: string;
  labelKey: string;
  route: string;
  roles: AdminRole[];
}

export const ADMIN_LANDING_PAGE_OPTIONS: AdminLandingPageOption[] = [
  {
    value: 'dashboard',
    labelKey: 'sidebar.dashboard',
    route: '/admin/dashboard',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'map-view',
    labelKey: 'sidebar.map',
    route: '/admin/map-view',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'destinations',
    labelKey: 'sidebar.destinations',
    route: '/admin/destinations',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'events',
    labelKey: 'sidebar.events',
    route: '/admin/events',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'activities',
    labelKey: 'sidebar.activities',
    route: '/admin/activities',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'places',
    labelKey: 'sidebar.places',
    route: '/admin/places',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'activity-log',
    labelKey: 'activity_log.title',
    route: '/admin/activity-log',
    roles: ['super_admin'],
  },
  {
    value: 'notifications-broadcast',
    labelKey: 'broadcast.title',
    route: '/admin/notifications/broadcast',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'reviews',
    labelKey: 'sidebar.reviews',
    route: '/admin/reviews',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'users',
    labelKey: 'sidebar.users',
    route: '/admin/users',
    roles: ['super_admin'],
  },
  {
    value: 'reports',
    labelKey: 'sidebar.reports',
    route: '/admin/reports',
    roles: ['super_admin', 'tourist_organization'],
  },
  {
    value: 'support',
    labelKey: 'sidebar.support',
    route: '/admin/support',
    roles: ['super_admin', 'tourist_organization', 'place_owner'],
  },
  {
    value: 'settings',
    labelKey: 'sidebar.settings',
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
