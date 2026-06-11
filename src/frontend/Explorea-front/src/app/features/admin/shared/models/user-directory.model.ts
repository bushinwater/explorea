import { PageQuery } from './pagination.model';

export type AdminUserRole = 'super_admin' | 'tourist_organization' | 'place_owner' | 'traveler';

export type AdminUserStatus = 'active' | 'inactive' | 'pending' | 'revoked';

export type AdminUserGender = 'male' | 'female' | 'other' | 'unknown';

export type UserAgeBucket = 'all' | 'under_20' | 'over_20';

export interface UserDirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUserRole;
  regionName: string | null;
  countryId: number | null;
  status: AdminUserStatus;
  gender: AdminUserGender;
  age: number | null;
  flagged: boolean;
  lastActivityAt: string | null;
  avatarUrl?: string | null;
  deletedAt?: string | null;
  hasPendingAppeal?: boolean;
  appealMessage?: string | null;
}

export interface UserDirectoryStats {
  totalUsers: number;
  maleUsers: number;
  femaleUsers: number;
  under20Users: number;
  over20Users: number;
  flaggedAccounts: number;
  averageAge?: number | null;
  registrationGrowthPercent?: number;
}

export type UserActivityStatus = 'all' | 'active' | 'inactive';

export interface UserDirectoryFilters extends PageQuery {
  search: string;
  role: AdminUserRole | 'all';
  region: string | 'all';
  gender: AdminUserGender | 'all';
  ageBucket: UserAgeBucket;
  activityStatus: UserActivityStatus;
}

export interface UpsertAdminUserDto {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUserRole;
  region: string | null;
  countryId: number | null;
  gender: Exclude<AdminUserGender, 'unknown'> | null;
  age: number | null;
  status: AdminUserStatus;
}

export interface UpdateAdminUserDto extends UpsertAdminUserDto {
  id: string;
}

export interface UserPermissionContext {
  role: AdminUserRole;
  region: string | null;
  canViewDirectory: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
}

export interface AdminUserLocation {
  cityName: string | null;
  regionName: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AdminUserInterest {
  id: number;
  name: string;
  icon: string | null;
  score: number | null;
}

export interface AdminUserActivityItem {
  entityType: string;
  entityId: string;
  entityName: string | null;
  entitySlug: string | null;
  at: string;
}

export interface AdminUserSavedItem {
  entityType: string;
  entityId: string;
  entityName: string | null;
  entitySlug: string | null;
  previewImageUrl: string | null;
  savedAt: string;
}

export interface AdminUserReview {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  entitySlug: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface AdminUserAdminAction {
  type: string;
  description: string;
  at: string;
}

export interface AdminUserOwnedEntity {
  id: string;
  entityType: string;
  name: string;
  slug: string | null;
  previewImageUrl: string | null;
  status: string | null;
  createdAt: string;
}

export interface AdminUserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  travelerRank: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  age: number | null;
  memberSince: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  plannerItemsTotal: number;
  location: AdminUserLocation | null;
  managedRegion: string | null;
  selectedInterests: AdminUserInterest[];
  topInterests: AdminUserInterest[];
  recentClicks: AdminUserActivityItem[];
  savedItems: AdminUserSavedItem[];
  savedItemsTotal: number;
  reviews: AdminUserReview[];
  reviewsTotal: number;
  recentAdminActions: AdminUserAdminAction[];
  ownedPlaces: AdminUserOwnedEntity[];
  ownedPlacesTotal: number;
  ownedEvents: AdminUserOwnedEntity[];
  ownedEventsTotal: number;
}
