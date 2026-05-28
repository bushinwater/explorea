import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardAuthService } from '../../core/services/dashboard-auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { AdminUiPreferencesService } from '../../core/services/admin-ui-preferences.service';
import {
  AdminBroadcastNotificationService,
  AdminNotificationItem,
} from '../../notifications/admin-broadcast-notification.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
})
export class AdminHeader implements OnInit, OnDestroy {
  showNotifications = false;

  readonly notifications = signal<AdminNotificationItem[]>([]);
  readonly unreadCount = signal(0);
  readonly isNotificationsLoading = signal(false);
  readonly notificationsError = signal('');

  private readonly subscription = new Subscription();

  constructor(
    public auth: DashboardAuthService,
    public layout: LayoutService,
    public ui: AdminUiPreferencesService,
    private readonly notificationService: AdminBroadcastNotificationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;

    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  openNotification(notification: AdminNotificationItem): void {
    this.markNotificationAsRead(notification);
    this.showNotifications = false;

    if (!notification.linkUrl) return;

    if (notification.linkUrl.startsWith('/')) {
      void this.router.navigateByUrl(notification.linkUrl);
      return;
    }

    window.location.href = notification.linkUrl;
  }

  markNotificationAsRead(notification: AdminNotificationItem): void {
    if (notification.isRead) return;

    this.subscription.add(
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => this.loadNotifications(),
      }),
    );
  }

  markAllNotificationsAsRead(): void {
    if (this.unreadCount() === 0) return;

    this.subscription.add(
      this.notificationService.markAllAsRead().subscribe({
        next: () => this.loadNotifications(),
      }),
    );
  }

  openSettings(): void {
    this.showNotifications = false;
    void this.router.navigate(['/admin/settings']);
  }

  formatNotificationTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('sr-Latn-RS', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private loadNotifications(): void {
    this.isNotificationsLoading.set(true);
    this.notificationsError.set('');

    this.subscription.add(
      this.notificationService.getInbox(10).subscribe({
        next: (inbox) => {
          this.notifications.set(inbox.items);
          this.unreadCount.set(inbox.unreadCount);
          this.isNotificationsLoading.set(false);
        },
        error: () => {
          this.notificationsError.set('Nije moguce ucitati obavestenja.');
          this.isNotificationsLoading.set(false);
        },
      }),
    );
  }
}
