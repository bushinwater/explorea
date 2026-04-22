import { Injectable, computed, signal } from '@angular/core';
import { AuthContext } from '../models/auth-context.model';

@Injectable({ providedIn: 'root' })
export class AdminAuthContextService {
  private readonly contextState = signal<AuthContext>({
    role: 'super_admin',
    region: 'Sve regije',
  });

  readonly context = this.contextState.asReadonly();

  readonly canViewUsersPage = computed(() => this.contextState().role !== 'traveler');
  readonly canManageUsers = computed(() => this.contextState().role === 'super_admin' || this.contextState().role === 'tourist_organization');
  readonly isSuperAdmin = computed(() => this.contextState().role === 'super_admin');

  setContext(context: AuthContext): void {
    this.contextState.set(context);
  }
}
