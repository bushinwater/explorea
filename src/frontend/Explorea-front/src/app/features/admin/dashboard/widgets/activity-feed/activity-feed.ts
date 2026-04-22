import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityItem } from '../../../core/models/admin.models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './activity-feed.html',
  styleUrl: './activity-feed.css',
})
export class ActivityFeed {
  @Input() items: ActivityItem[] = [];

  constructor(public ui: AdminUiPreferencesService) {}

  statusClass(status: ActivityItem['status']): string {
    return {
      pending:  'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
      info:     'badge-info',
      warning:  'badge-warning',
    }[status] ?? 'badge-muted';
  }

  statusLabel(status: ActivityItem['status']): string {
    const key = `dashboard.feed.status.${status}`;
    return this.ui.t(key) !== key ? this.ui.t(key) : status;
  }
}
