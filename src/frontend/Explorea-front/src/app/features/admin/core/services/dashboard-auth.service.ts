import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminRole, ROLE_LABELS } from '../models/admin.models';
import { AdminProfileService } from './admin-profile.service';

const STORAGE_KEY = 'explorea_admin_role';

@Injectable({ providedIn: 'root' })
export class DashboardAuthService {
  private readonly profileService = inject(AdminProfileService);
  private readonly authService = inject(AuthService);

  private _role = signal<AdminRole>(this.loadRole());
  readonly role = this._role.asReadonly();

  get roleLabel(): string { return ROLE_LABELS[this._role()]; }

  setRole(role: AdminRole): void {
    this._role.set(role);
    localStorage.setItem(STORAGE_KEY, role);
  }

  syncRoleFromJwt(): void {
    const jwtRole = this.authService.getRole();
    const valid: AdminRole[] = ['super_admin', 'tourist_organization', 'place_owner'];
    if (valid.includes(jwtRole as AdminRole)) {
      this._role.set(jwtRole as AdminRole);
      localStorage.setItem(STORAGE_KEY, jwtRole);
    }
  }

  private loadRole(): AdminRole {
    const stored = localStorage.getItem(STORAGE_KEY) as AdminRole | null;
    const valid: AdminRole[] = ['super_admin', 'tourist_organization', 'place_owner'];
    if (stored && valid.includes(stored)) return stored;

    // Fallback: čitaj iz JWT tokena
    const jwtRole = this.getJwtRole();
    return valid.includes(jwtRole as AdminRole) ? (jwtRole as AdminRole) : 'super_admin';
  }

  private getJwtRole(): string {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['role'] ?? '';
    } catch {
      return '';
    }
  }

  get userRegion(): string {
    const role = this._role();
    const profile = this.profileService.profile();
    if (role === 'super_admin') return profile?.countryContext ?? 'Srbija';
    if (role === 'tourist_organization') return profile?.managedRegionName ?? '';
    return '';
  }

  get userName(): string {
    const p = this.profileService.profile();
    if (p) return `${p.firstName} ${p.lastName}`;
    return '';
  }

  get userInitials(): string {
    const p = this.profileService.profile();
    if (p?.firstName && p?.lastName) return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
    return '?';
  }

  get profileImageUrl(): string | null {
    return this.profileService.profile()?.profileImageUrl ?? null;
  }
}
