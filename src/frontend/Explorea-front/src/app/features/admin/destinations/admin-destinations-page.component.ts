import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StatCardComponent } from '@shared/components';
import { Subject, Subscription, debounceTime, distinctUntilChanged, interval } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  DestinationCategory,
  DestinationDetail,
  DestinationFilters,
  DestinationRow,
  DestinationStats,
  DestinationStatus,
  InterestTagOption,
  RegionOption,
  ReviewItem,
  TypeOption,
} from './admin-destinations.models';
import { AdminDestinationsService } from './admin-destinations.service';
import { DestinationEditModalComponent } from './admin-destination-edit-modal.component';
import { DestinationCreateModalComponent } from './admin-destination-create-modal.component';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';
import { MapPreviewComponent } from '../shared/components/map-preview/map-preview.component';

@Component({
  selector: 'app-admin-destinations-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    MapPreviewComponent,
    TableSkeletonComponent,
    DestinationEditModalComponent,
    DestinationCreateModalComponent,
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
    extraFilters: {},
    page: 1,
    pageSize: 20,
  });

  protected readonly filterDefs = signal<FilterDefinition[]>([]);

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
  protected readonly isEditModalOpen = signal(false);
  protected readonly isEditModalClosing = signal(false);
  protected readonly isCreateModalOpen = signal(false);
  protected readonly selectedDestination = signal<DestinationRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly isDetailsPanelOpen = signal(false);
  protected readonly isPanelClosing = signal(false);
  protected readonly isDetailLoading = signal(false);
  protected readonly detailsPanelRow = signal<DestinationRow | null>(null);
  protected readonly detailsPanelDetail = signal<DestinationDetail | null>(null);
  protected readonly detailsPanelInterests = signal<InterestTagOption[]>([]);
  protected readonly detailsPanelReviews   = signal<ReviewItem[]>([]);
  protected readonly descriptionExpanded = signal(false);

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
      ...Object.keys(f.extraFilters).map(() => true),
    ].filter(Boolean).length;
  });

  protected readonly statuses: Array<{ value: DestinationStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Svi statusi' },
    { value: 'active', label: 'Aktivno' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly hoverRating = signal<number | null>(null);

  constructor(
    private readonly destinationsService: AdminDestinationsService,
    private readonly lookupService: LookupService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('create') === 'true') {
          this.openCreateModal();
        }
      }),
    );

    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        const q = value.trim();
        this.patchFilter({ search: value, page: 1 });
        if (!q) {
          this.loadDestinations();
          return;
        }
        this.loadDestinationsFuzzy(q);
      }),
    );

    this.loadStats();
    this.loadRegions();
    this.loadTypes();
    this.loadDestinations();

    this.subscription.add(
      interval(5 * 60 * 1000).subscribe(() => this.silentRefresh()),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyCategory(value: string | 'all'): void {
    this.patchFilter({ category: value, extraFilters: {}, page: 1 });
    if (value !== 'all') {
      const typeId = Number(value);
      if (typeId > 0) {
        this.subscription.add(
          this.lookupService.getFilterDefinitions('destination', typeId).subscribe({
            next: (defs) => this.filterDefs.set(defs),
            error: () => this.filterDefs.set([]),
          }),
        );
      } else {
        this.filterDefs.set([]);
      }
    } else {
      this.filterDefs.set([]);
    }
    this.loadDestinations();
  }

  protected applyExtraFilter(key: string, value: string): void {
    const current = this.filters().extraFilters;
    const updated = { ...current };
    if (updated[key] === value) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
    this.patchFilter({ extraFilters: updated, page: 1 });
    this.loadDestinations();
  }

  protected filterDefLabel(key: string): string {
    return this.filterDefs().find(d => d.filterKey === key)?.filterLabel ?? key;
  }

  protected applyStatus(value: DestinationStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadDestinations();
  }

  protected applyRegion(value: string | 'all'): void {
    this.patchFilter({ region: value, page: 1 });
    this.loadDestinations();
  }

  protected applyMinRating(value: number): void {
    const current = this.filters().minRating;
    this.patchFilter({ minRating: current === value ? null : value, page: 1 });
    this.loadDestinations();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      search: '',
      category: 'all',
      status: 'all',
      region: 'all',
      minRating: null,
      extraFilters: {},
      page: 1,
      pageSize: f.pageSize,
    }));
    this.filterDefs.set([]);
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
    this.isEditModalOpen.set(true);
  }

  protected openEditFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.openEdit(row);
  }

  protected openDeleteFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.closeDetailsPanel();
    this.openDeleteDialog(row);
  }

  protected formatRating(r: number): string {
    return r.toFixed(1);
  }

  protected starArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  protected closeEditModal(): void {
    this.isEditModalClosing.set(true);
    setTimeout(() => {
      this.isEditModalOpen.set(false);
      this.isEditModalClosing.set(false);
      this.selectedDestination.set(null);
    }, 220);
  }

  protected onEditSaved(updated: DestinationRow): void {
    this.successMessage.set(`„${updated.name}" je uspešno ažurirana.`);
    this.closeEditModal();
    this.silentRefresh();
  }

  protected openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.clearCreateQueryParam();
  }

  protected onDestinationCreated(row: DestinationRow): void {
    this.successMessage.set(`„${row.name}" je uspešno kreirana.`);
    this.closeCreateModal();
    this.loadDestinations();
    this.loadStats();
  }

  protected onTypeCreated(type: TypeOption): void {
    this.types.update(list => {
      if (list.some(t => t.id === type.id)) return list;
      return [...list, type];
    });
  }

  protected openDetailsPanel(dest: DestinationRow): void {
    this.detailsPanelRow.set(dest);
    this.detailsPanelDetail.set(null);
    this.detailsPanelInterests.set([]);
    this.isDetailsPanelOpen.set(true);
    this.isDetailLoading.set(true);
    this.descriptionExpanded.set(false);

    this.subscription.add(
      this.destinationsService.getDestinationById(dest.id).subscribe({
        next: (detail) => {
          this.detailsPanelDetail.set(detail);
          this.isDetailLoading.set(false);
        },
        error: () => {
          this.isDetailLoading.set(false);
        },
      }),
    );

    this.subscription.add(
      this.destinationsService.getDestinationInterests(dest.id).subscribe({
        next: (tags) => this.detailsPanelInterests.set(tags.filter(t => t.isAssigned)),
      }),
    );

    this.subscription.add(
      this.destinationsService.getDestinationReviews(dest.id).subscribe({
        next: reviews => this.detailsPanelReviews.set(reviews),
        error: () => this.detailsPanelReviews.set([]),
      }),
    );
  }

  protected closeDetailsPanel(): void {
    this.isPanelClosing.set(true);
    setTimeout(() => {
      this.isPanelClosing.set(false);
      this.isDetailsPanelOpen.set(false);
      this.detailsPanelRow.set(null);
      this.detailsPanelDetail.set(null);
      this.detailsPanelInterests.set([]);
      this.detailsPanelReviews.set([]);
    }, 220);
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

  protected formatDate(isoDate: string | null): string {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  private clearCreateQueryParam(): void {
    if (this.route.snapshot.queryParamMap.get('create') !== 'true') return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isDetailsPanelOpen() && !this.isPanelClosing()) {
      const target = event.target as Element;
      if (!target.closest('.ddp-panel') && !target.closest('.dest-card')) {
        this.closeDetailsPanel();
      }
    }
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

  private loadDestinationsFuzzy(query: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const allFilters = { ...this.filters(), search: '', page: 1, pageSize: 500 };

    this.subscription.add(
      this.destinationsService.getDestinations(allFilters).subscribe({
        next: (response) => {
          const q = query.toLowerCase();
          const matched = response.items.filter(d =>
            this.fuzzyMatch(d.name.toLowerCase(), q) ||
            (d.city && this.fuzzyMatch(d.city.toLowerCase(), q)) ||
            (d.region && this.fuzzyMatch(d.region.toLowerCase(), q)) ||
            (d.typeName && this.fuzzyMatch(d.typeName.toLowerCase(), q)),
          );
          this.destinations.set(matched);
          this.total.set(matched.length);
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

  private fuzzyMatch(text: string, query: string): boolean {
    if (text.includes(query)) return true;
    if (query.length < 3) return false;

    for (let i = 0; i < query.length - 1; i++) {
      const swapped = query.slice(0, i) + query[i + 1] + query[i] + query.slice(i + 2);
      if (text.includes(swapped)) return true;
    }

    if (query.length >= 4) {
      for (let i = 0; i < query.length; i++) {
        const shortened = query.slice(0, i) + query.slice(i + 1);
        if (text.includes(shortened)) return true;
      }
    }

    return false;
  }

  protected silentRefresh(): void {
    this.destinationsService.getDestinations(this.filters()).subscribe({
      next: (response) => {
        this.destinations.set(response.items);
        this.total.set(response.total);
      },
    });
    this.destinationsService.getStats().subscribe({
      next: (stats) => this.stats.set(stats),
    });
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
