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
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { formatCompactCount } from '../core/utils/compact-number.utils';
import { appendToReportsQueue } from '../core/utils/reports-queue.utils';
import { Chart, registerables } from 'chart.js';
import type { ReportQueueItem } from '../reports/admin-reports.models';

Chart.register(...registerables);
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { DependencyDeleteDialogComponent } from '../shared/components/dependency-delete-dialog/dependency-delete-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  AmenityOption,
  CountryOption,
  InterestTagOption,
  PlaceAnalytics,
  PlaceDetail,
  PlaceFilters,
  PlaceReview,
  PlaceRow,
  PlaceStats,
  PlaceStatus,
  PlaceTypeOption,
  RegionOption,
} from './admin-places.models';
import { AdminPlacesService } from './admin-places.service';
import { PlaceCreateModalComponent } from './admin-place-create-modal.component';
import { PlaceEditModalComponent } from './admin-place-edit-modal.component';
import { MapPreviewComponent } from '../shared/components/map-preview/map-preview.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-places-page',
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
    PlaceCreateModalComponent,
    PlaceEditModalComponent,
  ],
  templateUrl: './admin-places-page.component.html',
  styleUrl: './admin-places-page.component.css',
})
export class AdminPlacesPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<PlaceFilters>({
    search: '',
    typeId: 'all',
    status: 'all',
    regionId: 'all',
    minRating: null,
    amenityId: null,
    sortBy: 'none',
    page: 1,
    pageSize: 20,
  });

  protected readonly places    = signal<PlaceRow[]>([]);
  protected readonly listMode  = signal<'active' | 'pending' | 'deleted' | 'rejected'>('active');
  protected readonly stats     = signal<PlaceStats | null>(null);
  protected readonly types     = signal<PlaceTypeOption[]>([]);
  protected readonly regions   = signal<RegionOption[]>([]);
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly amenities = signal<AmenityOption[]>([]);
  protected readonly hoverRating = signal<number | null>(null);
  protected readonly total     = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading    = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen   = signal(false);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isRejectDialogOpen = signal(false);
  protected readonly rejectReason       = signal('');
  protected readonly isDependencyDialogOpen = signal(false);
  protected readonly isDeleting     = signal(false);
  protected readonly isRestoring    = signal(false);
  protected readonly reviewingPlaceId = signal<string | null>(null);
  protected readonly isReviewing = computed(() => this.reviewingPlaceId() !== null);
  protected readonly isEditModalOpen   = signal(false);
  protected readonly isCreateModalOpen = signal(false);
  protected readonly selectedPlace  = signal<PlaceRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage   = signal('');

  protected readonly isDetailsPanelOpen  = signal(false);
  protected readonly isPanelClosing      = signal(false);
  protected readonly isDetailLoading     = signal(false);
  protected readonly detailsPanelRow     = signal<PlaceRow | null>(null);
  protected readonly detailsPanelDetail  = signal<PlaceDetail | null>(null);
  protected readonly detailsPanelInterests = signal<InterestTagOption[]>([]);
  protected readonly detailsPanelReviews   = signal<PlaceReview[]>([]);
  protected readonly detailsPanelAnalytics = signal<PlaceAnalytics | null>(null);
  private analyticsChart: Chart | null = null;
  @ViewChild('analyticsCanvas') private analyticsCanvasRef?: ElementRef<HTMLCanvasElement>;

  private pendingScrollRowId: string | null = null;

  private scrollToPendingRow(): void {
    if (!this.pendingScrollRowId) return;
    const id = this.pendingScrollRowId;
    this.pendingScrollRowId = null;
    setTimeout(() => {
      const el = document.querySelector(`[data-admin-row-id="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }
  protected readonly descriptionExpanded = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.auth.getRole() === 'super_admin',
  );

  protected readonly isPlaceOwner = computed(
    () => this.auth.getRole() === 'place_owner',
  );

  protected readonly canReviewOwnerSubmissions = computed(() => {
    const role = this.auth.getRole();
    return role === 'super_admin' || role === 'tourist_organization';
  });

  protected readonly canSeeRegionFilter = computed(() => {
    const role = this.auth.getRole();
    return role === 'super_admin' || role === 'tourist_organization';
  });

  protected readonly lockedRegionId = computed(() =>
    this.dashAuth.role() === 'tourist_organization' ? this.dashAuth.managedRegionId : null,
  );

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.typeId !== 'all',
      f.status !== 'all',
      f.regionId !== 'all',
      f.minRating !== null,
      f.amenityId !== null,
    ].filter(Boolean).length;
  });

  protected get statuses(): Array<{ value: PlaceStatus | 'all'; label: string }> { return [
    { value: 'all',      label: this.ui.t('common.status.all') },
    { value: 'approved', label: this.ui.t('common.status.approved') },
    { value: 'pending',  label: this.ui.t('common.status.pending') },
    { value: 'rejected', label: this.ui.t('common.status.rejected') },
    { value: 'inactive', label: this.ui.t('common.status.inactive') },
  ]; }

  protected readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private readonly placesService: AdminPlacesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    protected readonly authContext: AdminAuthContextService,
    private readonly auth: AuthService,
    protected readonly ui: AdminUiPreferencesService,
    protected readonly dashAuth: DashboardAuthService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        const openId = params.get('openId');
        const statusParam = params.get('status') as PlaceStatus | 'all' | null;
        if (statusParam && ['all', 'approved', 'pending', 'rejected', 'inactive'].includes(statusParam)) {
          this.patchFilter({ status: statusParam, page: 1 });
          this.loadPlaces();
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { status: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }

        if (openId) {
          const openName = params.get('openName') ?? '';
          this.pendingScrollRowId = openId;
          this.openDetailsPanel({ id: openId, name: openName } as unknown as PlaceRow);
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
          this.loadPlaces();
          return;
        }
        this.loadPlacesFuzzy(q);
      }),
    );

    // Restore filter/sort state from the URL so reload/navigation lands on
    // the same view the user left. Runs before lockedRegionId is forced so
    // a TO admin's pinned region still wins.
    this.hydrateFiltersFromQueryParams();
    const rid = this.lockedRegionId();
    if (rid !== null) this.patchFilter({ regionId: rid });
    this.loadStats();
    this.loadTypes();
    this.loadRegions();
    this.loadCountries();
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('create') === 'true') {
          this.openCreateModal();
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { create: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      }),
    );
    const openEditId = (history.state as { openEditId?: string })?.openEditId ?? null;
    if (openEditId) this.pendingScrollRowId = openEditId;
    this.loadPlaces(openEditId ? (items) => {
      const place = items.find(p => p.id === openEditId);
      if (place) this.openEdit(place);
    } : undefined);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyType(typeId: number | 'all'): void {
    this.amenities.set([]);
    this.patchFilter({ typeId, amenityId: null, page: 1 });
    this.loadPlaces();
    if (typeId !== 'all') this.loadAmenities(typeId);
  }

  protected applyAmenity(amenityId: number | null): void {
    const current = this.filters().amenityId;
    this.patchFilter({ amenityId: amenityId === current ? null : amenityId, page: 1 });
    this.loadPlaces();
  }

  protected applyStatus(value: PlaceStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadPlaces();
  }

  protected applyRegion(regionId: number | 'all'): void {
    this.patchFilter({ regionId, page: 1 });
    this.loadPlaces();
  }

  protected applyMinRating(value: number): void {
    const current = this.filters().minRating;
    this.patchFilter({ minRating: current === value ? null : value, page: 1 });
    this.loadPlaces();
  }

  protected resetFilters(): void {
    this.amenities.set([]);
    this.hoverRating.set(null);
    this.filters.update((f) => ({
      search: '',
      typeId: 'all',
      status: 'all',
      regionId: 'all',
      minRating: null,
      amenityId: null,
      sortBy: 'none',
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.syncFiltersToQueryParams();
    this.loadPlaces();
  }

  protected toggleSort(): void {
    const next: Record<string, 'none' | 'updatedAt_desc' | 'updatedAt_asc'> = {
      none: 'updatedAt_desc', updatedAt_desc: 'updatedAt_asc', updatedAt_asc: 'none',
    };
    this.patchFilter({ sortBy: next[this.filters().sortBy], page: 1 });
    this.loadPlaces();
  }

  protected setListMode(mode: 'active' | 'pending' | 'deleted' | 'rejected'): void {
    if (this.listMode() === mode) return;
    this.listMode.set(mode);
    this.closeDetailsPanel();
    this.patchFilter({ page: 1 });
    this.currentPage.set(1);
    this.loadPlaces();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadPlaces();
  }

  protected openCreateModal(): void {
    if (this.listMode() === 'deleted' || this.listMode() === 'pending' || this.listMode() === 'rejected') return;
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  protected onPlaceCreated(detail: PlaceDetail): void {
    const isOwner = this.isPlaceOwner();
    this.successMessage.set(
      isOwner
        ? this.ui.t('places.success.submitted', { name: detail.name })
        : this.ui.t('places.success.created', { name: detail.name }),
    );
    this.closeCreateModal();
    // PlaceOwner submissions go to pending review — switch to the Pending tab
    // so they can immediately see their newly submitted request.
    if (isOwner && this.listMode() !== 'pending') {
      this.listMode.set('pending');
      this.patchFilter({ page: 1 });
      this.currentPage.set(1);
    }
    this.loadPlaces();
    this.loadStats();
    setTimeout(() => this.successMessage.set(''), 5000);
  }

  protected openEdit(row: PlaceRow): void {
    this.selectedPlace.set(row);
    this.isEditModalOpen.set(true);
  }

  protected openEditFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.openEdit(row);
  }

  protected closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedPlace.set(null);
  }

  protected onEditSaved(detail: PlaceDetail): void {
    this.successMessage.set(this.ui.t('places.success.updated', { name: detail.name }));
    this.closeEditModal();
    if (this.isDetailsPanelOpen() && this.detailsPanelRow()?.id === detail.id) {
      this.subscription.add(
        this.placesService.getById(detail.id).subscribe({
          next: (d) => this.detailsPanelDetail.set(d),
        }),
      );
    }
    this.loadPlaces();
    this.loadStats();
  }

  protected restorePlace(place: PlaceRow): void {
    this.isRestoring.set(true);
    this.subscription.add(
      this.placesService.restorePlace(place.id).subscribe({
        next: () => {
          this.isRestoring.set(false);
          this.successMessage.set(this.ui.t('places.success.restored', { name: place.name }));
          this.closeDetailsPanel();
          this.loadPlaces();
        },
        error: (err) => {
          this.isRestoring.set(false);
          // Backend returns a Serbian message for guard rails like
          // "destination still soft-deleted" — surface it instead of the
          // generic translated key.
          const msg = err?.error?.message;
          this.errorMessage.set(msg || this.ui.t('places.error.restore'));
        },
      }),
    );
  }

  protected approvePlace(place: PlaceRow): void {
    if (!this.canReviewOwnerSubmissions() || place.status !== 'pending' || this.isReviewing()) return;

    this.reviewingPlaceId.set(place.id);
    this.subscription.add(
      this.placesService.approvePlace(place.id).subscribe({
        next: () => {
          this.reviewingPlaceId.set(null);
          this.successMessage.set(this.ui.t('places.success.approved', { name: place.name }));
          this.closeDetailsPanel();
          this.loadPlaces();
          this.loadStats();
          setTimeout(() => this.successMessage.set(''), 4000);
        },
        error: (err) => {
          this.reviewingPlaceId.set(null);
          this.errorMessage.set(err?.error?.message ?? this.ui.t('places.error.approve'));
          setTimeout(() => this.errorMessage.set(''), 5000);
        },
      }),
    );
  }

  protected rejectPlace(place: PlaceRow): void {
    if (!this.canReviewOwnerSubmissions() || place.status !== 'pending' || this.isReviewing()) return;
    this.selectedPlace.set(place);
    this.rejectReason.set('');
    this.isRejectDialogOpen.set(true);
  }

  protected confirmReject(): void {
    const place = this.selectedPlace();
    if (!place) return;
    this.reviewingPlaceId.set(place.id);
    this.subscription.add(
      this.placesService.rejectPlace(place.id, this.rejectReason().trim() || 'Zahtev za objekat je odbijen.').subscribe({
        next: () => {
          this.reviewingPlaceId.set(null);
          this.isRejectDialogOpen.set(false);
          this.selectedPlace.set(null);
          this.successMessage.set(this.ui.t('places.success.rejected', { name: place.name }));
          this.closeDetailsPanel();
          this.loadPlaces();
          this.loadStats();
          setTimeout(() => this.successMessage.set(''), 4000);
        },
        error: () => {
          this.reviewingPlaceId.set(null);
          this.errorMessage.set(this.ui.t('places.error.reject'));
          setTimeout(() => this.errorMessage.set(''), 5000);
        },
      }),
    );
  }

  protected cancelReject(): void {
    this.isRejectDialogOpen.set(false);
    this.rejectReason.set('');
    if (!this.isReviewing()) this.selectedPlace.set(null);
  }

  protected openDetailsPanel(place: PlaceRow): void {

    // Enrich stub row from loaded rows when opened via openId.
    const loaded = this.places().find(r => r.id === place.id);
    if (loaded) place = { ...loaded, ...place, name: loaded.name };

    this.detailsPanelRow.set(place);
    this.detailsPanelDetail.set(null);
    this.detailsPanelInterests.set([]);
    this.isDetailsPanelOpen.set(true);
    this.isDetailLoading.set(true);
    this.descriptionExpanded.set(false);

    this.subscription.add(
      this.placesService.getById(place.id).subscribe({
        next: (detail) => {
          this.detailsPanelDetail.set(detail);
          this.isDetailLoading.set(false);
          const currentRow = this.detailsPanelRow();
          if (currentRow) {
            const firstImage = detail.images?.[0]?.imageUrl ?? null;
            this.detailsPanelRow.set({
              ...currentRow,
              name:            detail.name || currentRow.name,
              slug:            detail.slug || currentRow.slug,
              previewImageUrl: firstImage ?? currentRow.previewImageUrl,
              typeId:          detail.typeId ?? currentRow.typeId,
              type:            detail.type ?? currentRow.type,
              city:            detail.city ?? currentRow.city,
              region:          detail.region ?? currentRow.region,
              destination:     detail.destination ?? currentRow.destination,
              address:         detail.address ?? currentRow.address,
              avgRating:       detail.avgRating ?? currentRow.avgRating,
              isFeatured:      detail.isFeatured ?? currentRow.isFeatured,
              status:          detail.status ?? currentRow.status,
            });
          }
        },
        error: () => {
          this.isDetailLoading.set(false);
        },
      }),
    );

    this.subscription.add(
      this.placesService.getPlaceInterests(place.id).subscribe({
        next: tags => this.detailsPanelInterests.set(tags.filter(t => t.isAssigned)),
        error: () => {},
      }),
    );

    this.subscription.add(
      this.placesService.getPlaceReviews(place.id).subscribe({
        next: reviews => this.detailsPanelReviews.set(reviews),
        error: () => this.detailsPanelReviews.set([]),
      }),
    );

    this.detailsPanelAnalytics.set(null);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    this.subscription.add(
      this.placesService.getAnalytics(place.id).subscribe({
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

  protected plannerMonthLabel(iso: string | null): string {
    if (!iso) return '—';
    const [yearStr, monthStr] = iso.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return iso;
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString(this.ui.language() === 'en' ? 'en-US' : 'sr-RS', { month: 'long', year: 'numeric' });
  }

  protected sendAnalyticsToReports(): void {
    const place = this.detailsPanelRow();
    const a = this.detailsPanelAnalytics();
    if (!place || !a) return;

    const items: ReportQueueItem[] = [];
    const now = Date.now();

    if (a.viewsTimeline.length > 0) {
      const imageUrl = this.captureAnalyticsChartHighRes();
      if (imageUrl) {
        items.push({
          id: now.toString(),
          title: `${place.name} — ${this.ui.t('destinations.analytics.views_30d')}`,
          qtype: 'chart',
          imageUrl,
        });
      }
    }

    const rows = [
      { label: this.ui.t('destinations.analytics.saved_by_users'), value: a.savedByUsers },
      { label: this.ui.t('destinations.analytics.planner_users'),  value: a.plannerByUsers },
      { label: this.ui.t('places.analytics.events_count'),         value: a.eventCount },
      { label: this.ui.t('places.analytics.upcoming_events'),      value: a.upcomingEventCount },
      { label: this.ui.t('places.analytics.review_count'),         value: a.reviewCount },
    ];
    if (a.topPlannerMonth) {
      rows.push({
        label: `${this.ui.t('destinations.analytics.top_planner_month')} (${this.plannerMonthLabel(a.topPlannerMonth)})`,
        value: a.topPlannerMonthCount,
      });
    }

    items.push({
      id: (now + 1).toString(),
      title: `${place.name} — ${this.ui.t('events.analytics.user_interest')}`,
      qtype: 'table',
      data: rows,
      colLabel: this.ui.t('events.analytics.metric'),
      colValue: this.ui.t('events.analytics.users'),
    });

    appendToReportsQueue(items);
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reports']);
  }

  private captureAnalyticsChartHighRes(): string | null {
    const data = this.detailsPanelAnalytics();
    if (!data) return null;
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
    const url = canvas.toDataURL('image/png');
    tmpChart.destroy();
    return url;
  }

  protected openReviewInAdmin(reviewId: string): void {
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reviews'], {
      queryParams: { openReviewId: reviewId },
    });
  }

  protected closeDetailsPanel(): void {
    if (this.isPanelClosing()) return;
    this.isPanelClosing.set(true);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    setTimeout(() => {
      this.isDetailsPanelOpen.set(false);
      this.isPanelClosing.set(false);
      this.detailsPanelRow.set(null);
      this.detailsPanelDetail.set(null);
      this.detailsPanelInterests.set([]);
      this.detailsPanelAnalytics.set(null);
      this.detailsPanelReviews.set([]);
    }, 220);
  }

  protected openDeleteDialog(place: PlaceRow): void {
    this.selectedPlace.set(place);
    this.subscription.add(
      this.placesService.getPlaceDependencies(place.id, 1, 1).subscribe({
        next: (res) => {
          if (res.eventCount > 0) {
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

  protected openDeleteFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.closeDetailsPanel();
    this.openDeleteDialog(row);
  }

  protected closeDependencyDialog(): void {
    this.isDependencyDialogOpen.set(false);
    this.selectedPlace.set(null);
  }

  protected onDependencyDeleted(): void {
    const place = this.selectedPlace();
    this.isDependencyDialogOpen.set(false);
    this.selectedPlace.set(null);
    if (place) this.successMessage.set(`„${place.name}" i svi vezani dogadjaji su uspešno obrisani.`);
    this.loadPlaces();
    this.loadStats();
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedPlace.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const place = this.selectedPlace();
    if (!place) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.placesService.delete(place.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedPlace.set(null);
          this.successMessage.set(this.ui.t('places.success.deleted', { name: place.name }));
          this.loadPlaces();
          this.loadStats();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set(this.ui.t('places.error.delete'));
        },
      }),
    );
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

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString(this.dateLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  protected formatRating(r: number): string {
    return r.toFixed(1);
  }

  protected compactCount(n: number): string {
    return formatCompactCount(n);
  }

  protected statusLabel(status: PlaceStatus): string {
    return this.ui.t('common.status.' + status);
  }

  protected statusTooltip(status: string): string {
    return this.ui.t('common.status.tooltip.' + status);
  }

  protected ownerDocumentLabel(type: string): string {
    const map: Record<string, string> = {
      identity: 'Licni dokument',
      authorization: 'Dokaz vlasnistva/ovlascenja',
      license: 'Licenca/dozvola',
      other: 'Dokument',
    };
    return map[type] ?? 'Dokument';
  }

  protected placeIcon(typeName: string | null): string {
    const n = typeName?.toLowerCase() ?? '';
    if (n.includes('hotel') || n.includes('hostel') || n.includes('smešt')) return 'hotel';
    if (n.includes('restoran') || n.includes('restaurant')) return 'restaurant';
    if (n.includes('kafić') || n.includes('cafe') || n.includes('kafe')) return 'local_cafe';
    if (n.includes('bar') || n.includes('pub') || n.includes('lounge')) return 'sports_bar';
    if (n.includes('muzej') || n.includes('museum')) return 'museum';
    if (n.includes('galerij') || n.includes('gallery')) return 'image';
    if (n.includes('park') || n.includes('priroda')) return 'park';
    if (n.includes('wellness') || n.includes('spa')) return 'spa';
    if (n.includes('shopping') || n.includes('tržni')) return 'shopping_bag';
    return 'storefront';
  }

  protected placeThumbColor(typeName: string | null): string {
    const n = typeName?.toLowerCase() ?? '';
    if (n.includes('hotel') || n.includes('hostel')) return '#1e4d7b';
    if (n.includes('restoran') || n.includes('restaurant')) return '#8b3a2a';
    if (n.includes('kafić') || n.includes('cafe')) return '#5c4033';
    if (n.includes('muzej') || n.includes('museum')) return '#4a3060';
    if (n.includes('galerij')) return '#2d4a6b';
    if (n.includes('park')) return '#1f5c3a';
    if (n.includes('wellness') || n.includes('spa')) return '#2d6b6b';
    return '#3a5a6b';
  }

  protected starArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.isFilterOpen.set(false);
    if (this.isDetailsPanelOpen() && !this.isPanelClosing()) {
      const target = event.target as Element;
      // Same fix as admin-events-page: don't auto-close the DDP when a
      // click lands in the edit/create modal stacked over it.
      const insideAllowed =
           target.closest('.ddp-panel')
        || target.closest('.place-card')
        || target.closest('.edit-modal__panel')
        || target.closest('.edit-modal__backdrop')
        || target.closest('.confirm-dialog')
        || target.closest('.modal-shell');
      if (!insideAllowed) {
        this.closeDetailsPanel();
      }
    }
  }

  private patchFilter(patch: Partial<PlaceFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
    this.syncFiltersToQueryParams();
  }

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
    if (f.typeId !== 'all') qp['typeId'] = f.typeId;
    if (f.status !== 'all') qp['status'] = f.status;
    if (f.regionId !== 'all') qp['regionId'] = f.regionId;
    if (f.minRating !== null) qp['minRating'] = f.minRating;
    if (f.amenityId !== null) qp['amenityId'] = f.amenityId;
    if (f.sortBy !== 'none') qp['sortBy'] = f.sortBy;
    if (f.page > 1) qp['page'] = f.page;
    if (f.pageSize !== 20) qp['pageSize'] = f.pageSize;
    const create = this.route.snapshot.queryParamMap.get('create');
    if (create === 'true') qp['create'] = 'true';
    return qp;
  }

  private hydrateFiltersFromQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const page = this.parsePositiveIntPlace(qp.get('page'), 1);
    const pageSize = this.parsePositiveIntPlace(qp.get('pageSize'), this.filters().pageSize);

    const allowedStatuses: (PlaceStatus | 'all')[] = ['all', 'approved', 'pending', 'rejected', 'inactive'];
    const status = qp.get('status');
    const allowedSorts = ['none', 'updatedAt_desc', 'updatedAt_asc'] as const;
    const sortByRaw = qp.get('sortBy');
    const sortBy: PlaceFilters['sortBy'] = (allowedSorts as readonly string[]).includes(sortByRaw ?? '')
      ? (sortByRaw as PlaceFilters['sortBy'])
      : 'none';

    const typeRaw = qp.get('typeId');
    const typeN = typeRaw ? Number(typeRaw) : NaN;
    const regionRaw = qp.get('regionId');
    const regionN = regionRaw ? Number(regionRaw) : NaN;
    const amenityRaw = qp.get('amenityId');
    const amenityN = amenityRaw ? Number(amenityRaw) : NaN;
    const rawRating = qp.get('minRating');
    const ratingN = rawRating !== null ? Number(rawRating) : NaN;

    this.filters.set({
      search: qp.get('search')?.trim() ?? '',
      typeId: Number.isFinite(typeN) && typeN >= 1 ? typeN : 'all',
      status: allowedStatuses.includes(status as PlaceStatus | 'all') ? (status as PlaceStatus | 'all') : 'all',
      regionId: Number.isFinite(regionN) && regionN >= 1 ? regionN : 'all',
      minRating: Number.isFinite(ratingN) && ratingN >= 1 && ratingN <= 5 ? ratingN : null,
      amenityId: Number.isFinite(amenityN) && amenityN >= 1 ? amenityN : null,
      sortBy,
      page,
      pageSize,
    });

    this.currentPage.set(page);
  }

  private parsePositiveIntPlace(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private loadPlaces(afterLoad?: (items: PlaceRow[]) => void): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const mode = this.listMode();
    const request = mode === 'deleted'
      ? this.placesService.getDeletedPlaces(this.filters())
      : mode === 'pending'
        ? this.placesService.getPlaces({ ...this.filters(), status: 'pending' })
        : mode === 'rejected'
          ? this.placesService.getPlaces({ ...this.filters(), status: 'rejected' })
          : this.placesService.getPlaces(this.filters());

    this.subscription.add(
      request.subscribe({
        next: (response) => {
          this.places.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
          afterLoad?.(response.items);
          this.scrollToPendingRow();
        },
        error: () => {
          this.places.set([]);
          this.total.set(0);
          this.errorMessage.set(this.ui.t('places.error.load'));
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadPlacesFuzzy(query: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const allFilters = { ...this.filters(), search: '', page: 1, pageSize: 500 };

    this.subscription.add(
      this.placesService.getPlaces(allFilters).subscribe({
        next: (response) => {
          const q = query.toLowerCase();
          const matched = response.items.filter(p =>
            this.fuzzyMatch(p.name.toLowerCase(), q) ||
            (p.city && this.fuzzyMatch(p.city.toLowerCase(), q)) ||
            (p.region && this.fuzzyMatch(p.region.toLowerCase(), q)) ||
            (p.type && this.fuzzyMatch(p.type.toLowerCase(), q)) ||
            (p.destination && this.fuzzyMatch(p.destination.toLowerCase(), q)),
          );
          this.places.set(matched);
          this.total.set(matched.length);
          this.isLoading.set(false);
        },
        error: () => {
          this.places.set([]);
          this.total.set(0);
          this.errorMessage.set(this.ui.t('places.error.load'));
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

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.placesService.getStats().subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => this.isStatsLoading.set(false),
      }),
    );
  }

  private loadTypes(): void {
    this.subscription.add(
      this.placesService.getTypes().subscribe({
        next: (types) => this.types.set(types),
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.placesService.getRegions().subscribe({
        next: (regions) => this.regions.set(regions),
      }),
    );
  }

  private loadCountries(): void {
    this.subscription.add(
      this.placesService.getCountries().subscribe({
        next: (countries) => this.countries.set(countries),
      }),
    );
  }

  private loadAmenities(typeId: number): void {
    this.subscription.add(
      this.placesService.getAmenities(typeId).subscribe({
        next: (amenities) => this.amenities.set(amenities),
      }),
    );
  }
}
