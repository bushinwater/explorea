import { PageQuery } from './pagination.model';

export type AdminUserRole = 'super_admin' | 'tourist_organization' | 'place_owner' | 'traveler';

export type AdminUserStatus = 'active' | 'pending' | 'revoked';

export type AdminUserGender = 'male' | 'female' | 'other' | 'unknown';

export type UserAgeBucket = 'all' | 'under_20' | 'over_20';

export interface UserDirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUserRole;
  regionName: string | null;
  status: AdminUserStatus;
  gender: AdminUserGender;
  age: number | null;
  flagged: boolean;
  lastActivityAt: string | null;
  avatarUrl?: string | null;
}

export interface UserDirectoryStats {
  totalUsers: number;
  maleUsers: number;
  femaleUsers: number;
  under20Users: number;
  over20Users: number;
  flaggedAccounts: number;
}

export interface UserDirectoryFilters extends PageQuery {
  search: string;
  role: AdminUserRole | 'all';
  region: string | 'all';
  gender: AdminUserGender | 'all';
  ageBucket: UserAgeBucket;
}

export interface UpsertAdminUserDto {
  firstName: string;
  lastName: string;
  email: string;
  role: Exclude<AdminUserRole, 'traveler'>;
  region: string | null;
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
