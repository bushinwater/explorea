import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../../core/services/dashboard-auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { AdminUiPreferencesService } from '../../core/services/admin-ui-preferences.service';
import { AdminRole } from '../../core/models/admin.models';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
})
export class AdminHeader {
  showRolePicker = false;

  readonly roles: { value: AdminRole; label: string }[] = [
    { value: 'super_admin',          label: 'Super Admin' },
    { value: 'tourist_organization', label: 'Tourist Organization' },
    { value: 'place_owner',          label: 'Place Owner' },
  ];

  constructor(public auth: DashboardAuthService, public layout: LayoutService, public ui: AdminUiPreferencesService) {}

  get today(): string {
    const locale = this.ui.language() === 'en' ? 'en-US' : 'sr-RS';
    return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  selectRole(role: AdminRole): void {
    this.auth.setRole(role);
    this.showRolePicker = false;
  }

  get roleIcon(): string {
    switch (this.auth.role()) {
      case 'super_admin':          return 'admin_panel_settings';
      case 'tourist_organization': return 'location_city';
      case 'place_owner':          return 'storefront';
    }
  }
}
