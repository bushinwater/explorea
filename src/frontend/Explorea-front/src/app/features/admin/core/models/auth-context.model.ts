import { AdminUserRole } from '@shared/models';

export interface AuthContext {
  role: AdminUserRole;
  region: string | null;
}
