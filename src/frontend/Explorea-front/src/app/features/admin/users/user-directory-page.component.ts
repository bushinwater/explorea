import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import {
  AdminUserGender,
  AdminUserRole,
  PagedResponse,
  UserDirectoryFilters,
  UserDirectoryStats,
  UserDirectoryUser,
  UserAgeBucket,
  UpdateAdminUserDto,
  UpsertAdminUserDto,
} from '@shared/models';
import { AdminUserDirectoryService } from '@shared/services';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
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
  protected readonly regions = signal<string[]>([]);
  protected readonly users = signal<UserDirectoryUser[]>([]);
  protected readonly totalUsers = signal(0);
  protected readonly selectedUser = signal<UserDirectoryUser | null>(null);

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

  protected readonly pagedUsers = computed(() => this.users());

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.role !== 'all') count++;
    if (f.gender !== 'all') count++;
    if (f.ageBucket !== 'all') count++;
    if (f.region !== 'all') count++;
    return count;
  });

  protected readonly genderStatValue = computed(() => {
    const s = this.stats();
    const total = s.maleUsers + s.femaleUsers;
    if (!total) return '—';
    const mPct = Math.round((s.maleUsers / total) * 100);
    const fPct = 100 - mPct;
    return `${mPct}% M / ${fPct}% Ž`;
  });

  protected readonly avgAgeValue = computed(() => {
    const age = this.stats().averageAge;
    if (age == null) return '—';
    return `${age} god`;
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
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.updateFilterState({ search: value, page: 1 });
        this.loadUsers();
      }),
    );

    this.loadRegions();
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

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected resetFilters(): void {
    this.updateFilterState({ role: 'all', gender: 'all', ageBucket: 'all', region: 'all', page: 1 });
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
        error: (error: Error) => {
          this.isCreating.set(false);
          this.createErrorMessage.set(error.message || this.ui.t('users.form.error'));
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
        error: (error: Error) => {
          this.isUpdating.set(false);
          this.editErrorMessage.set(error.message || this.ui.t('users.form.error'));
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

  protected initials(user: UserDirectoryUser): string {
    return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  }

  protected roleLabel(role: AdminUserRole): string {
    return this.ui.t(`role.${role}`);
  }

  protected roleClass(role: AdminUserRole): string {
    return `role-pill--${role}`;
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

  private updateFilterState(patch: Partial<UserDirectoryFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
  }
}
