import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StatCardComponent } from '@shared/components';
import { Subject, Subscription, debounceTime, distinctUntilChanged, interval } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { formatCompactCount } from '../core/utils/compact-number.utils';
import { appendToReportsQueue } from '../core/utils/reports-queue.utils';
import { Chart, registerables } from 'chart.js';
import { DestinationAnalytics, AnalyticsTopChild } from './admin-destinations.models';
import type { ReportQueueItem } from '../reports/admin-reports.models';

Chart.register(...registerables);
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { DependencyDeleteDialogComponent } from '../shared/components/dependency-delete-dialog/dependency-delete-dialog.component';
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
    DependencyDeleteDialogComponent,
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
    sortBy: 'none',
    page: 1,
    pageSize: 20,
  });

  protected readonly filterDefs = signal<FilterDefinition[]>([]);

  protected readonly destinations = signal<DestinationRow[]>([]);
  protected readonly listMode = signal<'active' | 'deleted'>('active');
  protected readonly stats = signal<DestinationStats | null>(null);
  protected readonly regions = signal<RegionOption[]>([]);
  protected readonly types = signal<TypeOption[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDependencyDialogOpen = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly isRestoring = signal(false);
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
  protected readonly detailsPanelAnalytics = signal<DestinationAnalytics | null>(null);
  protected readonly descriptionExpanded = signal(false);
  private analyticsChart: Chart | null = null;
  @ViewChild('analyticsCanvas') private analyticsCanvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );

  protected readonly lockedRegionId = computed(() =>
    this.dashAuth.role() === 'tourist_organization' ? this.dashAuth.managedRegionId : null,
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

  protected get statuses(): Array<{ value: DestinationStatus | 'all'; label: string }> {
    return [
      { value: 'all',      label: this.ui.t('common.status.all') },
      { value: 'active',   label: this.ui.t('common.status.active') },
      { value: 'pending',  label: this.ui.t('common.status.pending') },
      { value: 'inactive', label: this.ui.t('common.status.inactive') },
      { value: 'rejected', label: this.ui.t('common.status.rejected') },
    ];
  }

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly hoverRating = signal<number | null>(null);

  protected readonly boundaryEditRegionId = signal<number | null>(null);
  protected readonly boundaryGeoJsonInput = signal('');
  protected readonly isSavingBoundary = signal(false);
  protected readonly regionsWithBoundary = signal<Set<number>>(new Set());

  constructor(
    private readonly destinationsService: AdminDestinationsService,
    private readonly lookupService: LookupService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
    protected readonly dashAuth: DashboardAuthService,
  ) {}

  private pendingScrollRowId: string | null = null;

  ngOnInit(): void {
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('create') === 'true') {
          this.openCreateModal();
        }
        const openId = params.get('openId');
        if (openId) {
          const openName = params.get('openName') ?? '';
          this.pendingScrollRowId = openId;
          this.openDetailsPanel({ id: openId, name: openName } as unknown as DestinationRow);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { openId: null, openName: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
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
    // Restore filter/sort state from the URL before the first load so the
    // user lands on the same list they left if they refresh, deep-link, or
    // navigate away and back.
    this.hydrateFiltersFromQueryParams();
    const openEditId = (history.state as { openEditId?: string })?.openEditId ?? null;
    if (openEditId) this.pendingScrollRowId = openEditId;
    this.loadDestinations(openEditId ? (items) => {
      const dest = items.find(d => d.id === openEditId);
      if (dest) this.openEdit(dest);
    } : undefined);

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
      sortBy: 'none',
      page: 1,
      pageSize: f.pageSize,
    }));
    this.filterDefs.set([]);
    this.currentPage.set(1);
    this.syncFiltersToQueryParams();
    this.loadDestinations();
  }

  protected toggleSort(): void {
    const next: Record<string, 'none' | 'updatedAt_desc' | 'updatedAt_asc'> = {
      none: 'updatedAt_desc', updatedAt_desc: 'updatedAt_asc', updatedAt_asc: 'none',
    };
    this.patchFilter({ sortBy: next[this.filters().sortBy], page: 1 });
    this.loadDestinations();
  }

  protected setListMode(mode: 'active' | 'deleted'): void {
    if (this.listMode() === mode) return;
    this.listMode.set(mode);
    this.closeDetailsPanel();
    this.patchFilter({ page: 1 });
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
    this.successMessage.set(this.ui.t('destinations.success.updated', { name: updated.name }));
    this.closeEditModal();
    this.silentRefresh();
  }

  protected openCreateModal(): void {
    if (this.listMode() === 'deleted') return;
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.clearCreateQueryParam();
  }

  protected onDestinationCreated(row: DestinationRow): void {
    this.successMessage.set(this.ui.t('destinations.success.created', { name: row.name }));
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

  protected restoreDestination(dest: DestinationRow): void {
    this.isRestoring.set(true);
    this.subscription.add(
      this.destinationsService.restoreDestination(dest.id).subscribe({
        next: () => {
          this.isRestoring.set(false);
          this.successMessage.set(this.ui.t('destinations.success.restored', { name: dest.name }));
          this.closeDetailsPanel();
          this.loadDestinations();
        },
        error: () => {
          this.isRestoring.set(false);
          this.errorMessage.set(this.ui.t('destinations.error.restore'));
        },
      }),
    );
  }

  protected openDetailsPanel(dest: DestinationRow): void {

    // If we were opened via openId we only have { id, name }. Try to enrich from loaded rows,
    // and always re-fetch the row from API so views / rating / category / region are accurate.
    const loaded = this.destinations().find(r => r.id === dest.id);
    if (loaded) dest = { ...loaded, ...dest, name: dest.name || loaded.name };

    this.detailsPanelRow.set(dest);
    this.detailsPanelDetail.set(null);
    this.detailsPanelInterests.set([]);
    this.isDetailsPanelOpen.set(true);
    this.isDetailLoading.set(true);
    this.descriptionExpanded.set(false);

    this.subscription.add(
      this.destinationsService.getDestinationRowById(dest.id).subscribe({
        next: (fullRow) => this.detailsPanelRow.set(fullRow),
      }),
    );

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

    this.detailsPanelAnalytics.set(null);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    this.subscription.add(
      this.destinationsService.getAnalytics(dest.id).subscribe({
        next: (analytics) => {
          this.detailsPanelAnalytics.set(analytics);
          setTimeout(() => this.renderAnalyticsChart(), 60);
        },
      }),
    );
  }

  private renderAnalyticsChart(): void {
    const data = this.detailsPanelAnalytics();
    if (!data || !this.analyticsCanvasRef?.nativeElement) return;
    this.analyticsChart?.destroy();
    this.analyticsChart = new Chart(this.analyticsCanvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: data.viewsTimeline.map(p => this.shortDate(p.date)),
        datasets: [{
          label: this.ui.t('destinations.analytics.views_label'),
          data: data.viewsTimeline.map(p => p.value),
          borderColor: '#2DD4BF',
          backgroundColor: 'rgba(45, 212, 191, 0.18)',
          tension: 0.3,
          fill: true,
          pointRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxTicksLimit: 8 } },
        },
      },
    });
  }

  private shortDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  protected openChildInAdmin(child: AnalyticsTopChild): void {
    const routeMap: Record<string, string> = {
      place: '/admin/places',
      activity: '/admin/activities',
      event: '/admin/events',
    };
    const route = routeMap[child.entityType];
    if (!route) return;
    this.closeDetailsPanel();
    void this.router.navigate([route], {
      queryParams: { openId: child.id, openName: child.name },
    });
  }

  protected openChildInApp(child: AnalyticsTopChild): void {
    if (!child.slug) return;
    const base: Record<string, string> = {
      place: '/places',
      activity: '/activities',
      event: '/events',
    };
    window.open(`${base[child.entityType]}/${child.slug}`, '_blank');
  }

  protected sendAnalyticsToReports(): void {
    const dest = this.detailsPanelRow();
    const a = this.detailsPanelAnalytics();
    if (!dest || !a) return;

    const items: ReportQueueItem[] = [];
    const now = Date.now();

    // Render an off-screen high-resolution chart so the PDF/preview has a crisp image.
    if (a.viewsTimeline.length > 0) {
      const imageUrl = this.captureAnalyticsChartHighRes();
      if (imageUrl) {
        items.push({
          id: (now).toString(),
          title: `${dest.name} — ${this.ui.t('destinations.analytics.views_30d')}`,
          qtype: 'chart',
          imageUrl,
        });
      }
    }
    const topRows: { label: string; child: AnalyticsTopChild | null }[] = [
      { label: this.ui.t('destinations.analytics.top_place'), child: a.topPlace },
      { label: this.ui.t('destinations.analytics.top_activity'), child: a.topActivity },
      { label: this.ui.t('destinations.analytics.top_event'), child: a.topEvent },
    ];
    const topData = topRows
      .filter(r => r.child)
      .map(r => ({ label: `${r.label}: ${r.child!.name}`, value: r.child!.views }));
    if (topData.length > 0) {
      items.push({
        id: (now + 1).toString(),
        title: `${dest.name} — ${this.ui.t('destinations.analytics.top_entities')}`,
        qtype: 'table',
        data: topData,
        colLabel: this.ui.t('destinations.analytics.entity'),
        colValue: this.ui.t('destinations.analytics.views_label'),
      });
    }

    appendToReportsQueue(items);
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reports']);
  }

  private captureAnalyticsChartHighRes(): string | null {
    const data = this.detailsPanelAnalytics();
    if (!data) return null;
    // Render to an off-screen canvas at high resolution so PDF/preview is crisp.
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 480;
    const tmpChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.viewsTimeline.map(p => this.shortDate(p.date)),
        datasets: [{
          label: this.ui.t('destinations.analytics.views_label'),
          data: data.viewsTimeline.map(p => p.value),
          borderColor: '#2DD4BF',
          backgroundColor: 'rgba(45, 212, 191, 0.18)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        },
      },
    });
    const dataUrl = canvas.toDataURL('image/png');
    tmpChart.destroy();
    return dataUrl;
  }

  protected plannerMonthLabel(iso: string | null): string {
    if (!iso) return '—';
    const [yearStr, monthStr] = iso.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return iso;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString(this.ui.language() === 'en' ? 'en-US' : 'sr-RS', { month: 'long', year: 'numeric' });
  }

  protected openReviewInAdmin(reviewId: string): void {
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reviews'], {
      queryParams: { openReviewId: reviewId },
    });
  }

  protected closeDetailsPanel(): void {
    this.isPanelClosing.set(true);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    setTimeout(() => {
      this.isPanelClosing.set(false);
      this.isDetailsPanelOpen.set(false);
      this.detailsPanelRow.set(null);
      this.detailsPanelDetail.set(null);
      this.detailsPanelInterests.set([]);
      this.detailsPanelReviews.set([]);
      this.detailsPanelAnalytics.set(null);
    }, 220);
  }

  protected openDeleteDialog(dest: DestinationRow): void {
    this.selectedDestination.set(dest);
    this.subscription.add(
      this.destinationsService.getDependencies(dest.id, 'events', 1, 1).subscribe({
        next: (res) => {
          const hasDeps = res.eventCount > 0 || res.placeCount > 0 || res.activityCount > 0;
          if (hasDeps) {
            this.isDependencyDialogOpen.set(true);
          } else {
            this.isDeleteDialogOpen.set(true);
          }
        },
        error: () => {
          this.isDeleteDialogOpen.set(true);
        },
      })
    );
  }

  protected closeDependencyDialog(): void {
    this.isDependencyDialogOpen.set(false);
    this.selectedDestination.set(null);
  }

  protected onDependencyDeleted(): void {
    const dest = this.selectedDestination();
    this.isDependencyDialogOpen.set(false);
    this.selectedDestination.set(null);
    if (dest) this.successMessage.set(`„${dest.name}" i sve vezane stavke su uspešno obrisane.`);
    this.loadDestinations();
    this.loadStats();
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
          this.successMessage.set(this.ui.t('destinations.success.deleted', { name: dest.name }));
          this.loadDestinations();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set(this.ui.t('destinations.error.delete'));
        },
      }),
    );
  }

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  protected formatDate(isoDate: string | null): string {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleDateString(this.dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected timeAgo(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return this.ui.t('common.time_ago.min', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.ui.t('common.time_ago.hours', { n: hours });
    const days = Math.floor(hours / 24);
    return this.ui.t('common.time_ago.days', { n: days });
  }

  protected formatBigNumber(n: number): string {
    return formatCompactCount(n);
  }

  protected formatViews(views: number): string {
    if (views == null) return '—';
    return formatCompactCount(views);
  }

  protected compactCount(n: number): string {
    return formatCompactCount(n);
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
    return this.ui.t('common.status.' + status);
  }

  protected statusTooltip(status: string): string {
    return this.ui.t('common.status.tooltip.' + status);
  }

  /** Activity-based pill key: aktivno = recent click in last 30 days OR created within 30 days. */
  protected activityStatusKey(dest: DestinationRow): 'active' | 'inactive' {
    return dest.hasRecentActivity ? 'active' : 'inactive';
  }

  protected activityStatusLabel(dest: DestinationRow): string {
    return this.ui.t('common.status.' + this.activityStatusKey(dest));
  }

  protected isDeleted(dest: DestinationRow): boolean {
    return this.listMode() === 'deleted';
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
    return this.ui.t('common.pagination', { from, to, total });
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
    this.syncFiltersToQueryParams();
  }

  /**
   * Serializes the current filter signal to the URL so any subsequent
   * re-init of this component (full page nav, lazy-route swap, even a
   * spurious filter signal reset triggered elsewhere) restores from a
   * single source of truth — the URL.
   *
   * Designed to be a no-op when the user hasn't touched anything: default
   * values (`'all'`, empty search, page 1, default pageSize) are omitted
   * so URLs stay clean.
   */
  private syncFiltersToQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(),
      replaceUrl: true,
    });
  }

  private buildQueryParams(): Record<string, unknown> {
    const f = this.filters();
    const qp: Record<string, unknown> = {};
    if (f.search.trim()) qp['search'] = f.search.trim();
    if (f.category !== 'all') qp['category'] = f.category;
    if (f.status !== 'all') qp['status'] = f.status;
    if (f.region !== 'all') qp['region'] = f.region;
    if (f.minRating !== null) qp['minRating'] = f.minRating;
    const efEntries = Object.entries(f.extraFilters);
    if (efEntries.length) qp['extraFilters'] = efEntries.map(([k, v]) => `${k}:${v}`);
    if (f.sortBy !== 'none') qp['sortBy'] = f.sortBy;
    if (f.page > 1) qp['page'] = f.page;
    if (f.pageSize !== 20) qp['pageSize'] = f.pageSize;
    // Preserve transient "create"/"openId" URL params so this sync doesn't
    // accidentally close an in-flight modal flow.
    const create = this.route.snapshot.queryParamMap.get('create');
    if (create === 'true') qp['create'] = 'true';
    return qp;
  }

  private hydrateFiltersFromQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const page = this.parsePositiveInt(qp.get('page'), 1);
    const pageSize = this.parsePositiveInt(qp.get('pageSize'), this.filters().pageSize);

    const extraFilters: Record<string, string> = {};
    for (const raw of qp.getAll('extraFilters')) {
      const idx = raw.indexOf(':');
      if (idx > 0) extraFilters[raw.slice(0, idx)] = raw.slice(idx + 1);
    }

    const allowedStatuses: (DestinationStatus | 'all')[] = ['active', 'pending', 'inactive', 'rejected', 'all'];
    const status = qp.get('status');
    const sortByRaw = qp.get('sortBy');
    const allowedSorts = ['none', 'updatedAt_desc', 'updatedAt_asc'] as const;
    const sortBy: DestinationFilters['sortBy'] = (allowedSorts as readonly string[]).includes(sortByRaw ?? '')
      ? (sortByRaw as DestinationFilters['sortBy'])
      : 'none';

    const rawRating = qp.get('minRating');
    const ratingN = rawRating !== null ? Number(rawRating) : NaN;

    this.filters.set({
      search: qp.get('search')?.trim() ?? '',
      category: qp.get('category') ?? 'all',
      status: allowedStatuses.includes(status as DestinationStatus | 'all') ? (status as DestinationStatus | 'all') : 'all',
      region: qp.get('region') ?? 'all',
      minRating: Number.isFinite(ratingN) && ratingN >= 1 && ratingN <= 5 ? ratingN : null,
      extraFilters,
      sortBy,
      page,
      pageSize,
    });

    this.currentPage.set(page);
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
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
      const insideAllowed =
           target.closest('.ddp-panel')
        || target.closest('.dest-card')
        || target.closest('.edit-modal__panel')
        || target.closest('.edit-modal__backdrop')
        || target.closest('.confirm-dialog')
        || target.closest('.modal-shell');
      if (!insideAllowed) {
        this.closeDetailsPanel();
      }
    }
  }

  private loadDestinations(afterLoad?: (items: DestinationRow[]) => void): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const request = this.listMode() === 'deleted'
      ? this.destinationsService.getDeletedDestinations(this.filters())
      : this.destinationsService.getDestinations(this.filters());

    this.subscription.add(
      request.subscribe({
        next: (response) => {
          this.destinations.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
          afterLoad?.(response.items);
          this.scrollToPendingRow();
        },
        error: () => {
          this.destinations.set([]);
          this.total.set(0);
          this.errorMessage.set(this.ui.t('destinations.error.load'));
          this.isLoading.set(false);
        },
      }),
    );
  }

  private scrollToPendingRow(): void {
    if (!this.pendingScrollRowId) return;
    const id = this.pendingScrollRowId;
    this.pendingScrollRowId = null;
    setTimeout(() => {
      const el = document.querySelector(`[data-admin-row-id="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
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
          this.errorMessage.set(this.ui.t('destinations.error.load'));
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
    const request = this.listMode() === 'deleted'
      ? this.destinationsService.getDeletedDestinations(this.filters())
      : this.destinationsService.getDestinations(this.filters());

    request.subscribe({
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
    this.subscription.add(
      this.destinationsService.getRegionsGeo().subscribe({
        next: (geo) => {
          this.regionsWithBoundary.set(new Set(geo.regions.map(r => r.id)));
        },
      }),
    );
  }

  protected openBoundaryEdit(regionId: number): void {
    this.boundaryEditRegionId.set(regionId);
    this.boundaryGeoJsonInput.set('');
  }

  protected closeBoundaryEdit(): void {
    this.boundaryEditRegionId.set(null);
    this.boundaryGeoJsonInput.set('');
  }

  protected saveBoundary(): void {
    const regionId = this.boundaryEditRegionId();
    if (!regionId || this.isSavingBoundary()) return;
    const geoJson = this.boundaryGeoJsonInput().trim() || null;
    this.isSavingBoundary.set(true);
    this.subscription.add(
      this.destinationsService.updateRegionBoundary(regionId, geoJson).subscribe({
        next: (result) => {
          this.isSavingBoundary.set(false);
          this.regionsWithBoundary.update(s => {
            const next = new Set(s);
            if (result.hasBoundary) next.add(regionId);
            else next.delete(regionId);
            return next;
          });
          this.successMessage.set(`Granica regiona "${result.name}" je ${result.hasBoundary ? 'postavljena' : 'uklonjena'}.`);
          this.closeBoundaryEdit();
        },
        error: (err) => {
          this.isSavingBoundary.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Greška pri čuvanju granice.');
        },
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
