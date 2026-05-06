import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { StatCardComponent } from '@shared/components';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  ActivityCategory,
  ActivityDifficulty,
  ActivityFilters,
  ActivityRow,
  ActivityStats,
  ActivityStatus,
} from './admin-activities.models';
import { AdminActivitiesService } from './admin-activities.service';

@Component({
  selector: 'app-admin-activities-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    TableSkeletonComponent,
  ],
  templateUrl: './admin-activities-page.component.html',
  styleUrl: './admin-activities-page.component.css',
})
export class AdminActivitiesPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<ActivityFilters>({
    search: '',
    category: 'all',
    status: 'all',
    difficulty: 'all',
    minRating: 'all',
    region: 'all',
    page: 1,
    pageSize: 7,
  });

  protected readonly activities = signal<ActivityRow[]>([]);
  protected readonly stats = signal<ActivityStats | null>(null);
  protected readonly regions = signal<string[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly activeMenuId = signal<string | null>(null);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly selectedActivity = signal<ActivityRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly activityToDelete = signal<ActivityRow | null>(null);
  protected readonly isDetailsPanelOpen = signal(false);
  protected readonly isUpdatingStatus = signal(false);
  protected readonly isDescriptionExpanded = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();

    return [
      f.category !== 'all',
      f.status !== 'all',
      f.difficulty !== 'all',
      f.minRating !== 'all',
      f.region !== 'all',
    ].filter(Boolean).length;
  });

  protected readonly categories: Array<{ value: ActivityCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Sve kategorije' },
    { value: 'hiking', label: 'Planinarenje' },
    { value: 'water_sports', label: 'Vodeni sportovi' },
    { value: 'culture', label: 'Kultura' },
    { value: 'gastronomy', label: 'Gastronomija' },
    { value: 'adventure', label: 'Avantura' },
    { value: 'wellness', label: 'Wellness' },
  ];

  protected readonly statuses: Array<{ value: ActivityStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Svi statusi' },
    { value: 'active', label: 'Aktivno' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  protected readonly difficulties: Array<{ value: ActivityDifficulty | 'all'; label: string }> = [
    { value: 'all', label: 'Sve težine' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ];

  protected readonly ratingOptions: Array<{ value: number | 'all'; label: string }> = [
    { value: 'all', label: 'Sve ocene' },
    { value: 3, label: 'Sve 3+' },
    { value: 4, label: 'Sve 4+' },
    { value: 4.5, label: 'Sve 4.5+' },
  ];

  constructor(
    private readonly activitiesService: AdminActivitiesService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.hydrateFiltersFromQueryParams();

    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.patchFilter({ search: value, page: 1 });
        this.loadActivities();
      }),
    );

    this.loadStats();
    this.loadRegions();
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyCategory(value: ActivityCategory | 'all'): void {
    this.patchFilter({ category: value, page: 1 });
    this.loadActivities();
  }

  protected applyStatus(value: ActivityStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadActivities();
  }

  protected applyDifficulty(value: ActivityDifficulty | 'all'): void {
    this.patchFilter({ difficulty: value, page: 1 });
    this.loadActivities();
  }

  protected applyRegion(value: string | 'all'): void {
    this.patchFilter({ region: value, page: 1 });
    this.loadActivities();
  }

  protected applyMinRating(value: number | 'all'): void {
    this.patchFilter({ minRating: value, page: 1 });
    this.loadActivities();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      search: '',
      category: 'all',
      status: 'all',
      difficulty: 'all',
      minRating: 'all',
      region: 'all',
      page: 1,
      pageSize: f.pageSize,
    }));

    this.currentPage.set(1);
    this.syncFiltersToQueryParams();
    this.loadActivities();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadActivities();
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.update((current) => (current === id ? null : id));
  }

  protected openDeleteDialog(activity: ActivityRow): void {
    this.activeMenuId.set(null);
    this.activityToDelete.set(activity);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.activityToDelete.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const activity = this.activityToDelete();
    if (!activity) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.activitiesService.deleteActivity(activity.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.activityToDelete.set(null);
          this.successMessage.set(`„${activity.name}" je uspešno uklonjena.`);
          this.loadActivities();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set('Greška pri brisanju aktivnosti.');
        },
      }),
    );
  }

  protected timeAgo(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `pre ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `pre ${hours} h`;
    const days = Math.floor(hours / 24);
    return `pre ${days} dana`;
  }

  protected formatBigNumber(n: number): string {
    return n.toLocaleString('en-US');
  }

  protected formatViews(views: number): string {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  }

  protected categoryLabel(cat: ActivityCategory): string {
    const map: Record<ActivityCategory, string> = {
      hiking: 'Planinarenje',
      water_sports: 'Vodeni sportovi',
      culture: 'Kultura',
      gastronomy: 'Gastronomija',
      adventure: 'Avantura',
      wellness: 'Wellness',
    };

    return map[cat];
  }

  protected categoryIcon(cat: ActivityCategory): string {
    const map: Record<ActivityCategory, string> = {
      hiking: 'hiking',
      water_sports: 'kayaking',
      culture: 'account_balance',
      gastronomy: 'restaurant',
      adventure: 'landscape',
      wellness: 'spa',
    };

    return map[cat];
  }

  protected statusLabel(status: ActivityStatus): string {
    const map: Record<ActivityStatus, string> = {
      active: 'Aktivno',
      pending: 'Na čekanju',
      inactive: 'Neaktivno',
      rejected: 'Odbijeno',
    };
    return map[status];
  }

  protected thumbColor(category: ActivityCategory): string {
    const map: Record<ActivityCategory, string> = {
      hiking: '#1f5c3a',
      water_sports: '#1e4d7b',
      culture: '#7c5c2e',
      gastronomy: '#8b3a2a',
      adventure: '#4a3060',
      wellness: '#2d6b6b',
    };

    return map[category];
  }

  protected thumbInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  protected difficultyLabel(difficulty: ActivityDifficulty): string {
    const map: Record<ActivityDifficulty, string> = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    };

    return map[difficulty];
  }

  protected formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  protected formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }

  protected visibleRangeText(): string {
    const total = this.total();
    if (!total) return '';
    const page = this.currentPage();
    const size = this.filters().pageSize;
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `Prikazano ${from}–${to} od ${total}`;
  }

  protected pageNumbers(): number[] {
    const total = this.totalPages();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const current = this.currentPage();
    const pages = new Set([1, total, current, current - 1, current + 1]);
    return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuId.set(null);
  }

  private patchFilter(patch: Partial<ActivityFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
    this.syncFiltersToQueryParams();
  }

  private hydrateFiltersFromQueryParams(): void {
    const queryParamMap = this.route.snapshot.queryParamMap;

    const page = this.parsePositiveInt(queryParamMap.get('page'), 1);
    const pageSize = this.parsePositiveInt(queryParamMap.get('pageSize'), this.filters().pageSize);

    this.filters.set({
      search: queryParamMap.get('search')?.trim() ?? '',
      category: this.parseCategory(queryParamMap.get('category')),
      status: this.parseStatus(queryParamMap.get('status')),
      difficulty: this.parseDifficulty(queryParamMap.get('difficulty')),
      minRating: this.parseMinRating(queryParamMap.get('minRating')),
      region: queryParamMap.get('region')?.trim() || 'all',
      page,
      pageSize,
    });

    this.currentPage.set(page);
  }

  private syncFiltersToQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(),
      replaceUrl: true,
    });
  }

  private buildQueryParams(): Record<string, string | number> {
    const filters = this.filters();
    const queryParams: Record<string, string | number> = {};

    if (filters.search.trim()) {
      queryParams['search'] = filters.search.trim();
    }

    if (filters.category !== 'all') {
      queryParams['category'] = filters.category;
    }

    if (filters.status !== 'all') {
      queryParams['status'] = filters.status;
    }

    if (filters.difficulty !== 'all') {
      queryParams['difficulty'] = filters.difficulty;
    }

    if (filters.minRating !== 'all') {
      queryParams['minRating'] = filters.minRating;
    }

    if (filters.region !== 'all') {
      queryParams['region'] = filters.region;
    }

    if (filters.page > 1) {
      queryParams['page'] = filters.page;
    }

    if (filters.pageSize !== 7) {
      queryParams['pageSize'] = filters.pageSize;
    }

    return queryParams;
  }

  private parseCategory(value: string | null): ActivityCategory | 'all' {
    return this.categories.some((category) => category.value === value)
      ? (value as ActivityCategory | 'all')
      : 'all';
  }

  private parseStatus(value: string | null): ActivityStatus | 'all' {
    return this.statuses.some((status) => status.value === value)
      ? (value as ActivityStatus | 'all')
      : 'all';
  }

  private parseDifficulty(value: string | null): ActivityDifficulty | 'all' {
    return this.difficulties.some((difficulty) => difficulty.value === value)
      ? (value as ActivityDifficulty | 'all')
      : 'all';
  }

  private parseMinRating(value: string | null): number | 'all' {
    if (!value || value === 'all') {
      return 'all';
    }

    const numericValue = Number(value);

    return this.ratingOptions.some((rating) => rating.value === numericValue)
      ? numericValue
      : 'all';
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      return fallback;
    }

    return parsed;
  }

  private loadActivities(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.activitiesService.getActivities(this.filters()).subscribe({
        next: (response) => {
          this.activities.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.activities.set([]);
          this.total.set(0);
          this.errorMessage.set('Greška pri učitavanju aktivnosti.');
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.activitiesService.getStats().subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => this.isStatsLoading.set(false),
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.activitiesService.getRegions().subscribe({
        next: (regions) => this.regions.set(regions),
      }),
    );
  }

  protected openDetailsPanel(activity: ActivityRow): void {
    this.activeMenuId.set(null);
    this.selectedActivity.set(activity);
    this.isDetailsPanelOpen.set(true);
    this.isDescriptionExpanded.set(false);
  }

  protected closeDetailsPanel(): void {
    this.isDetailsPanelOpen.set(false);
    this.selectedActivity.set(null);
    this.isDescriptionExpanded.set(false);
  }

  protected approveSelectedActivity(): void {
    this.updateSelectedActivityStatus('active', 'odobrena');
  }

  protected deactivateSelectedActivity(): void {
    this.updateSelectedActivityStatus('inactive', 'deaktivirana');
  }

  private updateSelectedActivityStatus(status: ActivityStatus, actionLabel: string): void {
    const activity = this.selectedActivity();
    if (!activity) return;

    this.isUpdatingStatus.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.activitiesService.updateActivityStatus(activity.id, status).subscribe({
        next: (updatedActivity) => {
          this.activities.update((items) =>
            items.map((item) => (item.id === updatedActivity.id ? updatedActivity : item)),
          );

          this.selectedActivity.set(updatedActivity);
          this.isUpdatingStatus.set(false);
          this.successMessage.set(`„${updatedActivity.name}" je ${actionLabel}.`);
        },
        error: () => {
          this.isUpdatingStatus.set(false);
          this.errorMessage.set('Greška pri promeni statusa aktivnosti.');
        },
      }),
    );
  }

  protected selectedCategoryLabel(): string {
    const value = this.filters().category;

    if (value === 'all') return '';

    return this.categories.find((category) => category.value === value)?.label ?? value;
  }

  protected selectedStatusLabel(): string {
    const value = this.filters().status;

    if (value === 'all') return '';

    return this.statuses.find((status) => status.value === value)?.label ?? value;
  }

  protected selectedDifficultyLabel(): string {
    const value = this.filters().difficulty;

    if (value === 'all') return '';

    return this.difficulties.find((difficulty) => difficulty.value === value)?.label ?? value;
  }

  protected selectedRatingLabel(): string {
    const value = this.filters().minRating;

    if (value === 'all') return '';

    return this.ratingOptions.find((rating) => rating.value === value)?.label ?? `${value}+`;
  }

  protected selectedRegionLabel(): string {
    const value = this.filters().region;

    if (value === 'all') return '';

    return value;
  }

  protected toggleDescription(): void {
    this.isDescriptionExpanded.update((current) => !current);
  }

  protected shouldShowDescriptionToggle(description: string): boolean {
    return description.length > 140;
  }

  protected visibleDescription(description: string): string {
    if (this.isDescriptionExpanded() || description.length <= 140) {
      return description;
    }

    return `${description.slice(0, 140).trimEnd()}...`;
  }
}
