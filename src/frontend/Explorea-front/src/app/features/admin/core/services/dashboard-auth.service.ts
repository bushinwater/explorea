import { Injectable, signal } from '@angular/core';
import { AdminRole, ROLE_LABELS } from '../models/admin.models';

const STORAGE_KEY = 'explorea_admin_role';

@Injectable({ providedIn: 'root' })
export class DashboardAuthService {
  private _role = signal<AdminRole>(this.loadRole());

  readonly role = this._role.asReadonly();

  get roleLabel(): string {
    return ROLE_LABELS[this._role()];
  }

  setRole(role: AdminRole): void {
    this._role.set(role);
    localStorage.setItem(STORAGE_KEY, role);
  }

  private loadRole(): AdminRole {
    const stored = localStorage.getItem(STORAGE_KEY) as AdminRole | null;
    const valid: AdminRole[] = ['super_admin', 'tourist_organization', 'place_owner'];
    return stored && valid.includes(stored) ? stored : 'super_admin';
  }

  // Mock user info
  get userName(): string {
    switch (this._role()) {
      case 'super_admin':          return 'Marko Jovanović';
      case 'tourist_organization': return 'Ana Nikolić';
      case 'place_owner':          return 'Stefan Petrović';
    }
  }

  get userInitials(): string {
    return this.userName.split(' ').map(n => n[0]).join('');
  }
}
