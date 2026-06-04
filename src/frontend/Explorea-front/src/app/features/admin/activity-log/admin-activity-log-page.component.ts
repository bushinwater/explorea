import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ActivityStatus } from '../core/models/admin.models';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

interface RawActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  actorId: string | null;
}

interface RawPage {
  items: RawActivity[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface FeedItem {
  id: string;
  initials: string;
  avatarColor: string;
  text: string;
  timestamp: string;
  status: ActivityStatus;
}

@Component({
  selector: 'app-admin-activity-log-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-activity-log-page.component.html',
  styleUrl: './admin-activity-log-page.component.css',
})
export class AdminActivityLogPageComponent implements OnInit {
  items = signal<FeedItem[]>([]);
  totalCount = signal(0);
  currentPage = signal(1);
  isLoading = signal(true);
  error = signal<string | null>(null);

  readonly pageSize = 20;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.load(1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
      pages.push(i);
    }
    return pages;
  }

  load(page: number): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<RawPage>(`/api/admin/activity/all?page=${page}&pageSize=${this.pageSize}`).subscribe({
      next: (res) => {
        this.items.set(res.items.map(item => this.mapItem(item)));
        this.totalCount.set(res.totalCount);
        this.currentPage.set(res.page);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set(this.ui.t('activity_log.error'));
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  statusClass(status: ActivityStatus): string {
    const map: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
      info: 'badge-info',
      warning: 'badge-warning',
    };
    return map[status] ?? 'badge-muted';
  }

  statusLabel(status: ActivityStatus): string {
    const keyMap: Record<string, string> = {
      pending: 'dashboard.feed.status.pending',
      approved: 'dashboard.feed.status.approved',
      rejected: 'dashboard.feed.status.rejected',
      info: 'dashboard.feed.status.info',
      warning: 'dashboard.feed.status.warning',
    };
    const key = keyMap[status];
    return key ? this.ui.t(key) : status;
  }

  private mapItem(item: RawActivity): FeedItem {
    return {
      id: item.id,
      initials: this.initials(item.type),
      avatarColor: this.color(item.type),
      text: item.description,
      timestamp: this.formatTimeAgo(item.createdAt),
      status: this.toStatus(item.type),
    };
  }

  private formatTimeAgo(value: string): string {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return '';
    const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return this.ui.t('dashboard.time.minutes_ago', { value: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.ui.t('dashboard.time.hours_ago', { value: hours });
    return this.ui.t('dashboard.time.days_ago', { value: Math.floor(hours / 24) });
  }

  private initials(type: string): string {
    const map: Record<string, string> = {
      destination_created: 'DE',
      user_registered: 'KO',
      submission_created: 'ZA',
      submission_reviewed: 'OD',
      review_created: 'RE',
      notification_broadcast_sent: 'OB',
    };
    return map[type] ?? 'AK';
  }

  private color(type: string): string {
    const map: Record<string, string> = {
      destination_created: '#28694c',
      user_registered: '#60a5fa',
      submission_created: '#d9b26f',
      submission_reviewed: '#34d399',
      review_created: '#a78bfa',
      notification_broadcast_sent: '#60a5fa',
    };
    return map[type] ?? '#8fa896';
  }

  private toStatus(type: string): ActivityStatus {
    if (type.includes('reviewed')) return 'approved';
    if (type.includes('submission_created')) return 'pending';
    if (type.includes('created') || type.includes('registered')) return 'info';
    return 'info';
  }
}
