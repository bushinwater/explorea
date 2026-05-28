import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  ElementRef, OnDestroy, OnInit, ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { DashboardAuthService } from '../../core/services/dashboard-auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { AdminUiPreferencesService } from '../../core/services/admin-ui-preferences.service';
import {
  AdminBroadcastNotificationService,
  AdminNotificationItem,
} from '../../notifications/admin-broadcast-notification.service';
import { AdminReportsService } from '../../reports/admin-reports.service';
import { AdminGlobalSearchResult } from '../../reports/admin-reports.models';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
})
export class AdminHeader implements OnInit, OnDestroy {
  @ViewChild('searchInputEl') private searchInputEl?: ElementRef<HTMLInputElement>;

  showNotifications = false;

  readonly notifications     = signal<AdminNotificationItem[]>([]);
  readonly unreadCount       = signal(0);
  readonly isNotificationsLoading = signal(false);
  readonly notificationsError     = signal('');

  // ─── Global search ───────────────────────────────────────────────────────
  readonly searchResults   = signal<AdminGlobalSearchResult[]>([]);
  readonly searchOpen      = signal(false);
  readonly searchLoading   = signal(false);
  readonly focusedIndex    = signal(-1);
  private  readonly searchInput$ = new Subject<string>();

  private readonly subscription = new Subscription();

  constructor(
    public  auth:    DashboardAuthService,
    public  layout:  LayoutService,
    public  ui:      AdminUiPreferencesService,
    private readonly notificationService: AdminBroadcastNotificationService,
    private readonly reportsService:      AdminReportsService,
    private readonly router:              Router,
    private readonly cdr:                 ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();

    this.subscription.add(
      this.searchInput$.pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap(q => {
          const trimmed = q.trim();
          if (trimmed.length < 2) {
            this.searchResults.set([]);
            this.searchOpen.set(false);
            this.searchLoading.set(false);
            this.focusedIndex.set(-1);
            return of([]);
          }
          this.searchLoading.set(true);
          return this.reportsService.globalSearch(trimmed);
        }),
      ).subscribe({
        next: results => {
          this.searchResults.set(results as AdminGlobalSearchResult[]);
          this.searchOpen.set((results as AdminGlobalSearchResult[]).length > 0);
          this.searchLoading.set(false);
          this.focusedIndex.set(-1);
          this.cdr.detectChanges();
        },
        error: () => {
          this.searchLoading.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  onSearchInput(value: string): void {
    this.focusedIndex.set(-1);
    this.searchInput$.next(value);
  }

  onSearchKeyDown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.focusedIndex();
      this.openResult(results[idx >= 0 ? idx : 0]);
    }
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchResults.set([]);
    this.focusedIndex.set(-1);
    this.searchInput$.next('');
    if (this.searchInputEl) {
      this.searchInputEl.nativeElement.value = '';
    }
  }

  openResult(result: AdminGlobalSearchResult): void {
    this.closeSearch();
    const route = this.entityRoute(result.entityType);
    void this.router.navigate([route], {
      queryParams: { openId: result.id, openName: result.name },
    });
  }

  entityIcon(type: string): string {
    return type === 'destination' ? 'place'
         : type === 'activity'    ? 'hiking'
         : type === 'event'       ? 'celebration'
         : 'store';
  }

  entityLabel(type: string): string {
    return type === 'destination' ? 'Destinacija'
         : type === 'activity'    ? 'Aktivnost'
         : type === 'event'       ? 'Dogadjaj'
         : 'Objekat';
  }

  private entityRoute(type: string): string {
    return type === 'destination' ? '/admin/destinations'
         : type === 'activity'    ? '/admin/activities'
         : type === 'event'       ? '/admin/events'
         : '/admin/places';
  }

  // ─── Notifications ───────────────────────────────────────────────────────

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) this.loadNotifications();
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

  formatNotificationTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('sr-Latn-RS', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
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
