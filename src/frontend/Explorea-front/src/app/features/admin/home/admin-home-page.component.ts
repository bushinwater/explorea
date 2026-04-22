import { Component } from '@angular/core';
import { UserDirectoryStats } from '@shared/models';
import { AdminReadonlyInfoComponent } from './admin-readonly-info.component';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { StatCardComponent } from '@shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-admin-home-page',
  standalone: true,
  imports: [StatCardComponent, StatusBadgeComponent, EmptyStateComponent, AdminReadonlyInfoComponent],
  templateUrl: './admin-home-page.component.html',
  styleUrl: './admin-home-page.component.css',
})
export class AdminHomePageComponent {
  constructor(
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  protected readonly stats: UserDirectoryStats = {
    totalUsers: 1284,
    maleUsers: 534,
    femaleUsers: 750,
    under20Users: 357,
    over20Users: 927,
    flaggedAccounts: 3,
  };
}
