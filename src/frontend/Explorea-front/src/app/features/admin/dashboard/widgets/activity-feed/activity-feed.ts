import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
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

  currentPage = 1;
  itemsPerPage = 3;

  constructor(public ui: AdminUiPreferencesService) {}

  get paginatedItems(): ActivityItem[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.items.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.items.length / this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  statusClass(status: ActivityItem['status']): string {
    return (
      {
        pending: 'badge-warning',
        approved: 'badge-success',
        rejected: 'badge-danger',
        info: 'badge-info',
        warning: 'badge-warning',
      }[status] ?? 'badge-muted'
    );
  }

  statusLabel(status: ActivityItem['status']): string {
    const key = `dashboard.feed.status.${status}`;
    return this.ui.t(key) !== key ? this.ui.t(key) : status;
  }
}
