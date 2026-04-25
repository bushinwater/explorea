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

  readonly roles: AdminRole[] = ['super_admin', 'tourist_organization', 'place_owner'];

  readonly notifCount = 3;

  constructor(public auth: DashboardAuthService, public layout: LayoutService, public ui: AdminUiPreferencesService) {}

  selectRole(role: AdminRole): void {
    this.auth.setRole(role);
    this.showRolePicker = false;
  }

}
