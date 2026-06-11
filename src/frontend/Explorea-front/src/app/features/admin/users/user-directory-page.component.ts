import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import {
  AdminUserDetails,
  AdminUserOwnedEntity,
  AdminUserGender,
  AdminUserRole,
  AdminUserStatus,
  PagedResponse,
  UserActivityStatus,
  UserDirectoryFilters,
  UserDirectoryStats,
  UserDirectoryUser,
  UserAgeBucket,
  UpdateAdminUserDto,
  UpsertAdminUserDto,
} from '@shared/models';
import { AdminUserDirectoryService } from '@shared/services';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { UserCreateModalComponent } from './user-create-modal.component';
import { UserEditModalComponent } from './user-edit-modal.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '@shared/components/feedback-banner/feedback-banner.component';
import { StatCardComponent } from '@shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { TableSkeletonComponent } from '@shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-user-directory-page',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    StatCardComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    TableSkeletonComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    UserCreateModalComponent,
    UserEditModalComponent,
  ],
  templateUrl: './user-directory-page.component.html',
  styleUrl: './user-directory-page.component.css',
})
export class UserDirectoryPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<UserDirectoryFilters>({
    page: 1,
    pageSize: 20,
    search: '',
    role: 'all',
    region: 'all',
    gender: 'all',
    ageBucket: 'all',
    activityStatus: 'all',
  });
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(true);
  protected readonly isStatsLoading = signal(true);
  protected readonly isFilterOpen = signal(false);
  protected readonly isCreateModalOpen = signal(false);
  protected readonly isEditModalOpen = signal(false);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly isUpdating = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly createErrorMessage = signal('');
  protected readonly editErrorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly activeTab = signal<'active' | 'deleted'>('active');
  protected readonly regions = signal<string[]>([]);
  protected readonly countries = signal<{ id: number; name: string }[]>([]);
  protected readonly users = signal<UserDirectoryUser[]>([]);

  protected readonly detailsPanelUser = signal<UserDirectoryUser | null>(null);
  protected readonly detailsPanelData = signal<AdminUserDetails | null>(null);
  protected readonly isDetailsLoading = signal(false);
  protected readonly isDetailsPanelClosing = signal(false);

  protected openDetailsPanel(user: UserDirectoryUser, event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button, a')) return;
    }
    this.detailsPanelUser.set(user);
    this.detailsPanelData.set(null);
    this.isDetailsLoading.set(true);
    this.subscription.add(
      this.adminUserDirectoryService.getUserDetails(user.id).subscribe({
        next: (details) => {
          this.detailsPanelData.set(details);
          this.isDetailsLoading.set(false);
        },
        error: () => {
          this.isDetailsLoading.set(false);
        },
      }),
    );
  }

  protected closeDetailsPanel(): void {
    if (this.isDetailsPanelClosing()) return;
    this.isDetailsPanelClosing.set(true);
    setTimeout(() => {
      this.detailsPanelUser.set(null);
      this.detailsPanelData.set(null);
      this.isDetailsPanelClosing.set(false);
    }, 200);
  }

  protected entityIcon(type: string): string {
    const map: Record<string, string> = {
      destination: 'landscape',
      place: 'store',
      activity: 'directions_walk',
      event: 'event',
    };
    return map[type.toLowerCase()] ?? 'circle';
  }

  protected entityTouristRoute(type: string, slug: string | null): string | null {
    if (!slug) return null;
    const map: Record<string, string> = {
      destination: '/destinations',
      place: '/places',
      activity: '/activities',
      event: '/events',
    };
    const base = map[type.toLowerCase()];
    return base ? `${base}/${slug}` : null;
  }

  protected formatRelative(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return 'upravo';
    if (min < 60) return `pre ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `pre ${h}h`;
    const days = Math.round(h / 24);
    if (days < 30) return `pre ${days} d.`;
    return d.toLocaleDateString();
  }

  protected genderLabel(g: string | null): string {
    if (!g) return this.ui.t('users.details.placeholder_dash');
    const keyMap: Record<string, string> = {
      male: 'users.details.gender_male',
      female: 'users.details.gender_female',
      other: 'users.details.gender_other',
      unknown: 'users.details.gender_unknown',
    };
    const key = keyMap[g];
    return key ? this.ui.t(key) : g;
  }

  protected adminEntityRoute(type: string): string | null {
    const map: Record<string, string> = {
      destination: '/admin/destinations',
      place: '/admin/places',
      activity: '/admin/activities',
      event: '/admin/events',
    };
    return map[type.toLowerCase()] ?? null;
  }

  protected openEntityInAdmin(type: string, id: string, name?: string | null): void {
    const route = this.adminEntityRoute(type);
    if (!route) return;
    this.closeDetailsPanel();
    void this.router.navigate([route], {
      queryParams: { openId: id, openName: name ?? '' },
    });
  }

  protected openReviewInAdmin(reviewId: string): void {
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reviews'], {
      queryParams: { openReviewId: reviewId },
    });
  }

  // ===== Owned entities popup (place_owner) =====
  protected readonly ownedPopupOpen = signal(false);
  protected readonly ownedPopupTab = signal<'place' | 'event'>('place');
  protected readonly ownedAllPlaces = signal<AdminUserOwnedEntity[]>([]);
  protected readonly ownedAllEvents = signal<AdminUserOwnedEntity[]>([]);
  protected readonly ownedLoading = signal(false);

  protected openAllOwned(initialTab: 'place' | 'event' = 'place'): void {
    const user = this.detailsPanelUser();
    if (!user) return;
    this.ownedPopupTab.set(initialTab);
    this.ownedPopupOpen.set(true);
    this.ownedLoading.set(true);
    this.ownedAllPlaces.set([]);
    this.ownedAllEvents.set([]);
    this.subscription.add(
      this.adminUserDirectoryService.getUserOwnedEntities(user.id, 'place').subscribe({
        next: items => this.ownedAllPlaces.set(items),
      }),
    );
    this.subscription.add(
      this.adminUserDirectoryService.getUserOwnedEntities(user.id, 'event').subscribe({
        next: items => {
          this.ownedAllEvents.set(items);
          this.ownedLoading.set(false);
        },
        error: () => this.ownedLoading.set(false),
      }),
    );
  }

  protected closeOwnedPopup(): void {
    this.ownedPopupOpen.set(false);
  }
  protected readonly totalUsers = signal(0);
  protected readonly selectedUser = signal<UserDirectoryUser | null>(null);
  protected readonly deletedUsers = signal<UserDirectoryUser[]>([]);
  protected readonly totalDeletedUsers = signal(0);
  protected readonly deletedPage = signal(1);
  protected readonly isDeletedLoading = signal(false);
  protected readonly isRestoring = signal(false);
  protected readonly restoreTarget = signal<UserDirectoryUser | null>(null);
  protected readonly isRestoreDialogOpen = signal(false);

  protected readonly stats = signal<UserDirectoryStats>({
    totalUsers: 0,
    maleUsers: 0,
    femaleUsers: 0,
    under20Users: 0,
    over20Users: 0,
    flaggedAccounts: 0,
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalUsers() / this.filters().pageSize)),
  );

  protected readonly totalDeletedPages = computed(() =>
    Math.max(1, Math.ceil(this.totalDeletedUsers() / 20)),
  );

  protected readonly pagedUsers = computed(() => this.users());

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.role !== 'all') count++;
    if (f.gender !== 'all') count++;
    if (f.ageBucket !== 'all') count++;
    if (f.region !== 'all') count++;
    if (f.activityStatus !== 'all') count++;
    return count;
  });

  protected readonly genderStatValue = computed(() => {
    const s = this.stats();
    const total = s.maleUsers + s.femaleUsers;
    if (!total) return '—';
    const mPct = Math.round((s.maleUsers / total) * 100);
    const fPct = 100 - mPct;
    return `${mPct}% / ${fPct}%`;
  });

  protected readonly avgAgeValue = computed(() => {
    const age = this.stats().averageAge;
    if (age == null) return '—';
    return `${age} ${this.ui.t('common.years_abbr')}`;
  });

  protected readonly growthValue = computed(() => {
    const g = this.stats().registrationGrowthPercent ?? 0;
    return g >= 0 ? `+${g}%` : `${g}%`;
  });

  protected readonly growthTone = computed(() => {
    const g = this.stats().registrationGrowthPercent ?? 0;
    return g >= 0 ? 'success' : 'danger';
  });

  protected readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  constructor(
    private readonly adminUserDirectoryService: AdminUserDirectoryService,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
    private readonly dashboardAuth: DashboardAuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.updateFilterState({ search: value, page: 1 });
        this.loadUsers();
      }),
    );

    this.loadRegions();
    this.loadCountries();
    this.loadStats();
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected setRole(role: AdminUserRole | 'all'): void {
    this.updateFilterState({ role, page: 1 });
    this.loadUsers();
  }

  protected updateRegion(value: string): void {
    this.updateFilterState({ region: value as string | 'all', page: 1 });
    this.loadUsers();
  }

  protected updateGender(value: string): void {
    this.updateFilterState({ gender: value as AdminUserGender | 'all', page: 1 });
    this.loadUsers();
  }

  protected updateAge(value: string): void {
    this.updateFilterState({ ageBucket: value as UserAgeBucket, page: 1 });
    this.loadUsers();
  }

  protected updateActivityStatus(value: UserActivityStatus): void {
    this.updateFilterState({ activityStatus: value, page: 1 });
    this.loadUsers();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected resetFilters(): void {
    this.updateFilterState({ role: 'all', gender: 'all', ageBucket: 'all', region: 'all', activityStatus: 'all', page: 1 });
    this.loadUsers();
  }

  protected openCreateModal(): void {
    this.createErrorMessage.set('');
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.createErrorMessage.set('');
    this.isCreating.set(false);
    this.isCreateModalOpen.set(false);
  }

  protected openEditModal(user: UserDirectoryUser): void {
    this.editErrorMessage.set('');
    this.selectedUser.set(user);
    this.isEditModalOpen.set(true);
  }

  protected closeEditModal(): void {
    this.editErrorMessage.set('');
    this.isUpdating.set(false);
    this.selectedUser.set(null);
    this.isEditModalOpen.set(false);
  }

  protected openDeleteDialog(user: UserDirectoryUser): void {
    this.selectedUser.set(user);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedUser.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected createUser(dto: UpsertAdminUserDto): void {
    this.isCreating.set(true);
    this.createErrorMessage.set('');

    this.subscription.add(
      this.adminUserDirectoryService.createUser(dto).subscribe({
        next: () => {
          this.isCreating.set(false);
          this.isCreateModalOpen.set(false);
          this.successMessage.set(this.ui.t('users.saved_create'));
          this.loadRegions();
          this.loadStats();
          this.loadUsers();
        },
        error: (err: HttpErrorResponse) => {
          this.isCreating.set(false);
          const msg = err.error?.message || err.message || this.ui.t('users.form.error');
          this.createErrorMessage.set(msg);
        },
      }),
    );
  }

  protected updateUser(dto: UpdateAdminUserDto): void {
    this.isUpdating.set(true);
    this.editErrorMessage.set('');

    this.subscription.add(
      this.adminUserDirectoryService.updateUser(dto).subscribe({
        next: () => {
          this.isUpdating.set(false);
          this.isEditModalOpen.set(false);
          this.selectedUser.set(null);
          this.successMessage.set(this.ui.t('users.saved_update'));
          this.loadRegions();
          this.loadStats();
          this.loadUsers();
        },
        error: (err: HttpErrorResponse) => {
          this.isUpdating.set(false);
          const msg = err.error?.message || err.message || this.ui.t('users.form.error');
          this.editErrorMessage.set(msg);
        },
      }),
    );
  }

  protected deleteUser(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.adminUserDirectoryService.deleteUser(user.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedUser.set(null);
          this.successMessage.set(this.ui.t('users.saved_delete'));
          this.loadRegions();
          this.loadStats();
          this.loadUsers();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set(this.ui.t('users.error.delete'));
        },
      }),
    );
  }

  protected goToPreviousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  protected goToNextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  protected goToPage(page: number): void {
    const nextPage = this.clampPage(page);
    this.updateFilterState({ page: nextPage });
    this.loadUsers();
  }

  protected readonly brokenAvatarIds = new Set<string>();

  protected initials(user: UserDirectoryUser): string {
    return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  }

  protected roleLabel(role: AdminUserRole): string {
    return this.ui.t(`role.${role}`);
  }

  protected roleClass(role: AdminUserRole): string {
    return `role-pill--${role}`;
  }

  protected displayStatus(user: UserDirectoryUser): AdminUserStatus {
    if (user.status === 'revoked') return 'revoked';
    if (user.status === 'pending') return 'pending';
    if (!user.lastActivityAt) return 'inactive';
    const diffMs = Date.now() - new Date(user.lastActivityAt).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 30 ? 'active' : 'inactive';
  }

  protected activityLabel(value: string | null): string {
    if (!value) return this.ui.t('users.activity.never');

    const diffMs = Date.now() - new Date(value).getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMinutes < 60) return this.ui.t('users.activity.minutes', { value: diffMinutes });

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return this.ui.t('users.activity.hours', { value: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    return this.ui.t('users.activity.days', { value: diffDays });
  }

  protected canManageUser(user: UserDirectoryUser): boolean {
    if (user.id === this.dashboardAuth.currentUserId) return false;

    const context = this.authContext.context();

    if (context.role === 'super_admin') return true;

    if (context.role === 'tourist_organization') {
      return Boolean(context.region) && user.regionName === context.region;
    }

    return false;
  }

  protected lockedRegionForCreate(): string | null {
    const context = this.authContext.context();
    return context.role === 'tourist_organization' ? context.region : null;
  }

  protected visibleRangeText(): string {
    const total = this.totalUsers();
    if (!total) return this.ui.t('users.pagination.empty');

    const page = this.clampPage(this.currentPage());
    const pageSize = this.filters().pageSize;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return this.ui.t('users.pagination.range', { from, to, total });
  }

  private clampPage(page: number): number {
    return Math.min(Math.max(page, 1), this.totalPages());
  }

  private loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.currentPage.set(this.filters().page);

    this.subscription.add(
      this.adminUserDirectoryService.getUsers(this.filters()).subscribe({
        next: (response: PagedResponse<UserDirectoryUser>) => {
          this.users.set(response.items);
          this.totalUsers.set(response.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.users.set([]);
          this.totalUsers.set(0);
          this.errorMessage.set(this.ui.t('users.error.load'));
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);

    this.subscription.add(
      this.adminUserDirectoryService.getStats().subscribe({
        next: (stats: UserDirectoryStats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => {
          this.isStatsLoading.set(false);
        },
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.adminUserDirectoryService.getRegions().subscribe({
        next: (regions: string[]) => this.regions.set(regions),
      }),
    );
  }

  private loadCountries(): void {
    this.subscription.add(
      this.adminUserDirectoryService.getCountries().subscribe({
        next: (countries) => this.countries.set(countries),
      }),
    );
  }

  protected switchTab(tab: 'active' | 'deleted'): void {
    this.activeTab.set(tab);
    if (tab === 'deleted' && !this.deletedUsers().length) {
      this.loadDeletedUsers();
    }
  }

  protected goToDeletedPage(page: number): void {
    const next = Math.min(Math.max(page, 1), this.totalDeletedPages());
    this.deletedPage.set(next);
    this.loadDeletedUsers();
  }

  protected openRestoreDialog(user: UserDirectoryUser): void {
    this.restoreTarget.set(user);
    this.isRestoreDialogOpen.set(true);
  }

  protected closeRestoreDialog(): void {
    this.restoreTarget.set(null);
    this.isRestoring.set(false);
    this.isRestoreDialogOpen.set(false);
  }

  protected restoreUser(): void {
    const user = this.restoreTarget();
    if (!user) return;

    this.isRestoring.set(true);
    this.subscription.add(
      this.adminUserDirectoryService.restoreUser(user.id).subscribe({
        next: () => {
          this.closeRestoreDialog();
          this.successMessage.set(this.ui.t('users.restored'));
          this.loadDeletedUsers();
          this.loadStats();
        },
        error: () => {
          this.isRestoring.set(false);
          this.errorMessage.set(this.ui.t('users.error.restore'));
        },
      }),
    );
  }

  protected daysUntilPurge(deletedAt: string): number {
    const deleted = new Date(deletedAt).getTime();
    const purgeAt = deleted + 30 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  private loadDeletedUsers(): void {
    this.isDeletedLoading.set(true);
    this.subscription.add(
      this.adminUserDirectoryService.getDeletedUsers(this.deletedPage(), 20).subscribe({
        next: (res) => {
          this.deletedUsers.set(res.items);
          this.totalDeletedUsers.set(res.total);
          this.isDeletedLoading.set(false);
        },
        error: () => {
          this.deletedUsers.set([]);
          this.isDeletedLoading.set(false);
        },
      }),
    );
  }

  private updateFilterState(patch: Partial<UserDirectoryFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
  }
}
