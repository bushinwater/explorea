import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { StatCardComponent } from '@shared/components';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  DestinationCategory,
  DestinationFilters,
  DestinationRow,
  DestinationStats,
  DestinationStatus,
  RegionOption,
  TypeOption,
} from './admin-destinations.models';
import { AdminDestinationsService } from './admin-destinations.service';

@Component({
  selector: 'app-admin-destinations-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    TableSkeletonComponent,
  ],
  templateUrl: './admin-destinations-page.component.html',
  styleUrl: './admin-destinations-page.component.css',
})
export class AdminDestinationsPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<DestinationFilters>({
    search: '',
    category: 'all',
    status: 'all',
    region: 'all',
    minRating: null,
    page: 1,
    pageSize: 17,
  });

  protected readonly destinations = signal<DestinationRow[]>([]);
  protected readonly stats = signal<DestinationStats | null>(null);
  protected readonly regions = signal<RegionOption[]>([]);
  protected readonly types = signal<TypeOption[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly selectedDestination = signal<DestinationRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

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
      f.region !== 'all',
      f.minRating !== null,
    ].filter(Boolean).length;
  });

  protected readonly statuses: Array<{ value: DestinationStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Svi statusi' },
    { value: 'active', label: 'Aktivno' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  protected readonly ratingFilters: Array<{ value: number | null; label: string }> = [
    { value: null, label: 'Sve ocene' },
    { value: 4, label: '★ 4+' },
    { value: 3, label: '★ 3+' },
    { value: 2, label: '★ 2+' },
  ];

  constructor(
    private readonly destinationsService: AdminDestinationsService,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.patchFilter({ search: value, page: 1 });
        this.loadDestinations();
      }),
    );

    this.loadStats();
    this.loadRegions();
    this.loadTypes();
    this.loadDestinations();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyCategory(value: string | 'all'): void {
    this.patchFilter({ category: value, page: 1 });
    this.loadDestinations();
  }

  protected applyStatus(value: DestinationStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadDestinations();
  }

  protected applyRegion(value: string | 'all'): void {
    this.patchFilter({ region: value, page: 1 });
    this.loadDestinations();
  }

  protected applyMinRating(value: number | null): void {
    this.patchFilter({ minRating: value, page: 1 });
    this.loadDestinations();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      search: '',
      category: 'all',
      status: 'all',
      region: 'all',
      minRating: null,
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.loadDestinations();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadDestinations();
  }

  protected openEdit(row: DestinationRow): void {
    this.selectedDestination.set(row);
  }

  protected openCreateModal(): void {
  }

  protected openDeleteDialog(dest: DestinationRow): void {
    this.selectedDestination.set(dest);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedDestination.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const dest = this.selectedDestination();
    if (!dest) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.destinationsService.deleteDestination(dest.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedDestination.set(null);
          this.successMessage.set(`„${dest.name}" je uspešno uklonjena.`);
          this.loadDestinations();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set('Greška pri brisanju destinacije.');
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

  protected addedLast30DaysValue(): number {
    return this.stats()?.addedLast30Days ?? 0;
  }

  protected topDestinationPercent(views: number): number {
    const maxViews = this.stats()?.topDestinations?.[0]?.views ?? 0;
    if (maxViews <= 0) return 0;
    return Math.max(8, Math.round((views / maxViews) * 100));
  }

  protected categoryLabel(cat: DestinationCategory): string {
    const map: Record<DestinationCategory, string> = {
      cultural: 'Kulturno',
      nature: 'Priroda',
      gastronomy: 'Gastronomija',
      adventure: 'Avantura',
      wellness: 'Wellness',
      historical: 'Istorijsko',
    };
    return map[cat];
  }

  protected categoryIcon(cat: DestinationCategory): string {
    const map: Record<DestinationCategory, string> = {
      cultural: 'account_balance',
      nature: 'park',
      gastronomy: 'restaurant',
      adventure: 'landscape',
      wellness: 'spa',
      historical: 'history_edu',
    };
    return map[cat];
  }

  protected statusLabel(status: DestinationStatus): string {
    const map: Record<DestinationStatus, string> = {
      active: 'Aktivno',
      pending: 'Na čekanju',
      inactive: 'Neaktivno',
      rejected: 'Odbijeno',
    };
    return map[status];
  }

  protected thumbColor(category: DestinationCategory): string {
    const map: Record<DestinationCategory, string> = {
      cultural: '#7c5c2e',
      nature: '#1f5c3a',
      gastronomy: '#8b3a2a',
      adventure: '#1e4d7b',
      wellness: '#2d6b6b',
      historical: '#4a3060',
    };
    return map[category];
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

  private patchFilter(patch: Partial<DestinationFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }

  private loadDestinations(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.destinationsService.getDestinations(this.filters()).subscribe({
        next: (response) => {
          this.destinations.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.destinations.set([]);
          this.total.set(0);
          this.errorMessage.set('Greška pri učitavanju destinacija.');
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.destinationsService.getStats().subscribe({
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
      this.destinationsService.getRegions().subscribe({
        next: (regions) => this.regions.set(regions),
      }),
    );
  }

  private loadTypes(): void {
    this.subscription.add(
      this.destinationsService.getTypes().subscribe({
        next: (types) => this.types.set(types),
      }),
    );
  }
}
