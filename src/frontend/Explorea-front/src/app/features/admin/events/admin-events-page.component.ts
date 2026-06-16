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
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { StatCardComponent } from '@shared/components';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { formatCompactCount } from '../core/utils/compact-number.utils';
import { appendToReportsQueue } from '../core/utils/reports-queue.utils';
import { Chart, registerables } from 'chart.js';
import type { ReportQueueItem } from '../reports/admin-reports.models';

Chart.register(...registerables);
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { effect, untracked } from '@angular/core';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalShellComponent } from '../shared/components/modal-shell/modal-shell.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  EventFilterOption,
  EventFilters,
  EventPriority,
  EventRow,
  EventStats,
  EventType,
  EventsTab,
  InterestTagOption,
  EventAnalytics,
  ReviewItem,
} from './admin-events.models';
import { AdminEventsService } from './admin-events.service';
import { EventCreateModalComponent } from './admin-event-create-modal.component';
import { EventEditModalComponent } from './admin-event-edit-modal.component';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';
import { MapPreviewComponent } from '../shared/components/map-preview/map-preview.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-events-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    ModalShellComponent,
    EmptyStateComponent,
    TableSkeletonComponent,
    EventCreateModalComponent,
    EventEditModalComponent,
    MapPreviewComponent,
  ],
  templateUrl: './admin-events-page.component.html',
  styleUrl: './admin-events-page.component.css',
})
export class AdminEventsPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<EventFilters>({
    search: '',
    typeId: null,
    cityId: null,
    destinationId: null,
    extraFilters: {},
    tab: 'active',
    sortBy: 'none',
    selectedDate: null,
    page: 1,
    pageSize: 20,
  });

  protected readonly filterDefs = signal<FilterDefinition[]>([]);

  // ─── Calendar filter (mirrors the tourist events page layout) ──────────
  readonly DAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
  protected calendarViewDate = new Date();
  protected selectedCalendarDate: Date | null = null;
  protected calendarGrid: { date: Date; isCurrentMonth: boolean; count: number }[] = [];
  /** Map of `YYYY-MM-DD` → number of events on that day in the current view month. */
  private calendarCounts = new Map<string, number>();

  protected readonly events = signal<EventRow[]>([]);
  protected readonly stats = signal<EventStats | null>(null);
  protected readonly eventTypeOptions = signal<EventFilterOption<number>[]>([]);
  protected readonly cityOptions = signal<EventFilterOption<number>[]>([]);
  protected readonly destinationOptions = signal<EventFilterOption<string>[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly activeMenuId = signal<string | null>(null);

  protected readonly selectedEvent = signal<EventRow | null>(null);
  protected readonly isPanelOpen = signal(false);
  protected readonly isPanelClosing = signal(false);
  private _editFromPanel = false;

  protected readonly isCreateOpen = signal(false);
  protected readonly isCreateClosing = signal(false);
  protected readonly isEditOpen = signal(false);
  protected readonly isEditClosing = signal(false);

  protected readonly confirmAction = signal<'approve' | 'reject' | 'forward' | 'delete' | 'owner-approve' | 'owner-reject' | 'reactivate' | 'reforward' | null>(null);
  protected readonly isConfirmOpen = signal(false);
  protected readonly isActioning = signal(false);
  protected readonly isRestoring = signal(false);
  protected readonly isRenewOpen = signal(false);
  protected readonly isRenewing = signal(false);
  protected readonly renewMode = signal<'nextYear' | 'custom'>('nextYear');
  protected readonly renewDateInput = signal('');
  protected readonly rejectReason = signal('');

  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly descriptionExpanded = signal(false);
  protected readonly detailsInterests = signal<InterestTagOption[]>([]);
  protected readonly detailsReviews   = signal<ReviewItem[]>([]);
  protected readonly detailsAnalytics = signal<EventAnalytics | null>(null);
  private analyticsChart: Chart | null = null;
  @ViewChild('analyticsCanvas') private analyticsCanvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly isSuperAdmin = computed(
    () => this.auth.getRole() === 'super_admin',
  );
  protected readonly isPlaceOwner = computed(
    () => this.auth.getRole() === 'place_owner',
  );
  protected readonly canCreateEvent = computed(() => {
    const role = this.auth.getRole();
    return role === 'super_admin' || role === 'tourist_organization' || role === 'place_owner';
  });
  protected readonly canRenewExpiredEvent = computed(() => {
    const role = this.auth.getRole();
    return role === 'super_admin' || role === 'tourist_organization';
  });

  protected readonly lockedRegionId = computed(() =>
    this.dashAuth.role() === 'tourist_organization' ? this.dashAuth.managedRegionId : null,
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );
  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.typeId !== null,
      f.cityId !== null,
      f.destinationId !== null,
      f.selectedDate !== null,
      ...Object.keys(f.extraFilters).map(() => true),
    ].filter(Boolean).length;
  });

  protected readonly extraFilterEntries = computed(() =>
    Object.entries(this.filters().extraFilters).map(([key, value]) => ({ key, value }))
  );
  protected readonly confirmTitle = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve') return 'Odobriti zahtev za događaj?';
    if (a === 'reject') return 'Odbiti zahtev?';
    if (a === 'delete') return 'Obrisati događaj?';
    if (a === 'owner-approve') return 'Odobriti događaj na vašem objektu?';
    if (a === 'owner-reject') return 'Odbiti događaj na vašem objektu?';
    if (a === 'reactivate') return 'Odobriti odbijeni događaj?';
    if (a === 'reforward') return 'Prosleđuj odbijeni događaj vlasniku?';
    return 'Prosleđuj vlasniku?';
  });
  protected readonly confirmDesc = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve') return 'Organizator će biti obavešten da je njihov događaj odobren.';
    if (a === 'reject') return 'Ova akcija se ne može poništiti. Organizator će biti obavešten o odbijanju.';
    if (a === 'delete') return `Da li sigurno želiš da ukloniš događaj "${this.selectedEvent()?.name ?? ''}"? Događaj će biti premešten u sekciju "Obrisano" gde ostaje 30 dana pre trajnog brisanja.`;
    if (a === 'owner-approve') return 'Potvrđujete da dozvoljavate organizaciju ovog događaja na vašem objektu. Događaj će biti objavljen.';
    if (a === 'owner-reject') return 'Organizator će biti obavešten da ste odbili organizaciju događaja na vašem objektu.';
    if (a === 'reactivate') return 'Događaj će biti objavljen i vidljiv korisnicima. Organizator će biti obavešten.';
    if (a === 'reforward') return 'Vlasnik objekta će dobiti zahtev za odobrenje.';
    return 'Vlasnik objekta će dobiti zahtev za odobrenje.';
  });
  protected readonly confirmButtonLabel = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve' || a === 'owner-approve' || a === 'reactivate') return 'Odobri';
    if (a === 'reject' || a === 'owner-reject') return 'Odbij';
    if (a === 'delete') return 'Obriši';
    if (a === 'forward' || a === 'reforward') return 'Prosleđuj';
    return 'Potvrdi';
  });
  protected readonly confirmLoadingLabel = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve' || a === 'owner-approve' || a === 'reactivate') return 'Odobravanje...';
    if (a === 'reject' || a === 'owner-reject') return 'Odbijanje...';
    if (a === 'delete') return 'Brisanje...';
    if (a === 'forward' || a === 'reforward') return 'Slanje...';
    return 'Obrada...';
  });

  constructor(
    private readonly eventsService: AdminEventsService,
    private readonly lookupService: LookupService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    protected readonly authContext: AdminAuthContextService,
    private readonly auth: AuthService,
    protected readonly dashAuth: DashboardAuthService,
    protected readonly ui: AdminUiPreferencesService,
    private readonly http: HttpClient,
  ) {
    effect(() => {
      const rid = this.lockedRegionId();
      if (rid !== null) {
        untracked(() => this.loadFilterOptions());
      }
    });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        const openId = params.get('openId');
        const tabParam = params.get('tab') as EventsTab | null;
        if (tabParam && ['active', 'pending', 'deleted', 'rejected', 'history', 'expired'].includes(tabParam)) {
          this.patchFilter({ tab: tabParam, page: 1 });
          this.loadEvents();
        }

        if (openId) {
          const openName = params.get('openName') ?? '';
          this.pendingScrollRowId = openId;
          this.openDetailsPanel({ id: openId, name: openName } as unknown as EventRow);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { openId: null, openName: null, tab: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        } else if (tabParam) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab: null },
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
          this.loadEvents();
          return;
        }
        this.loadEventsFuzzy(q);
      }),
    );
    this.loadStats();
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('create') === 'true') {
          this.openCreateDialog();
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { create: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      }),
    );
    // Za TO korisnike: ako profil nije još učitan, effect će pozvati loadFilterOptions kad stigne
    if (this.lockedRegionId() !== null || this.dashAuth.role() !== 'tourist_organization') {
      this.loadFilterOptions();
    }
    const openEditId = (history.state as { openEditId?: string })?.openEditId ?? null;
    if (openEditId) this.pendingScrollRowId = openEditId;
    this.loadEvents(openEditId ? (items) => {
      const ev = items.find(e => e.id === openEditId);
      if (ev) this.openEditFromRow(ev);
    } : undefined);
    this.loadCalendarMonth();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected setTab(tab: EventsTab): void {
    this.selectedEvent.set(null);
    this.isPanelOpen.set(false);
    this.isPanelClosing.set(false);
    this.patchFilter({ tab, page: 1 });
    this.loadEvents();
    this.loadCalendarMonth();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyType(typeId: number | null): void {
    this.patchFilter({ typeId, extraFilters: {}, page: 1 });
    if (typeId !== null) {
      this.loadFilterDefs(typeId);
    } else {
      this.filterDefs.set([]);
    }
    this.loadEvents();
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
    this.loadEvents();
  }

  protected applyCity(cityId: number | null): void {
    this.patchFilter({ cityId, page: 1 });
    this.loadEvents();
  }

  protected applyDestination(destinationId: string | null): void {
    this.patchFilter({ destinationId, page: 1 });
    this.loadEvents();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      search: '',
      typeId: null,
      cityId: null,
      destinationId: null,
      extraFilters: {},
      tab: f.tab,
      sortBy: 'none',
      selectedDate: null,
      page: 1,
      pageSize: f.pageSize,
    }));
    this.selectedCalendarDate = null;
    this.loadCalendarMonth();
    this.filterDefs.set([]);
    this.currentPage.set(1);
    this.loadEvents();
  }

  protected toggleSort(): void {
    const next: Record<string, 'none' | 'updatedAt_desc' | 'updatedAt_asc'> = {
      none: 'updatedAt_desc', updatedAt_desc: 'updatedAt_asc', updatedAt_asc: 'none',
    };
    this.patchFilter({ sortBy: next[this.filters().sortBy], page: 1 });
    this.loadEvents();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadEvents();
  }

  protected openReviewInAdmin(reviewId: string): void {
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reviews'], {
      queryParams: { openReviewId: reviewId },
    });
  }

  protected openDetailsPanel(event: EventRow): void {
    this.activeMenuId.set(null);
    this.descriptionExpanded.set(false);

    // Enrich stub row from loaded rows when opened via openId.
    const loaded = this.events().find(r => r.id === event.id);
    if (loaded) event = { ...loaded, ...event, name: event.name || loaded.name };

    this.selectedEvent.set(event);
    this.isPanelOpen.set(true);
    this.detailsInterests.set([]);

    this.subscription.add(
      this.eventsService.getEventDetail(event.id, event).subscribe({
        next: (detailedEvent) => {
          const current = this.selectedEvent();
          if (current?.id === event.id && current?.queueId === event.queueId) {
            this.selectedEvent.set(detailedEvent);
          }
        },
        error: () => {
          this.errorMessage.set('Nije moguće učitati detalje događaja.');
          setTimeout(() => this.errorMessage.set(''), 4000);
        },
      }),
    );

    this.subscription.add(
      this.eventsService.getEventInterests(event.id).subscribe({
        next: (tags) => this.detailsInterests.set(tags.filter(t => t.isAssigned)),
        error: () => {},
      }),
    );

    this.subscription.add(
      this.eventsService.getEventReviews(event.id).subscribe({
        next: reviews => this.detailsReviews.set(reviews),
        error: () => this.detailsReviews.set([]),
      }),
    );

    this.detailsAnalytics.set(null);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    this.subscription.add(
      this.eventsService.getAnalytics(event.id).subscribe({
        next: (analytics) => {
          this.detailsAnalytics.set(analytics);
          setTimeout(() => this.renderAnalyticsChart(), 60);
        },
      }),
    );
  }

  private renderAnalyticsChart(): void {
    const data = this.detailsAnalytics();
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

  protected plannerDateLabel(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(this.ui.language() === 'en' ? 'en-US' : 'sr-RS', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected sendAnalyticsToReports(): void {
    const ev = this.selectedEvent();
    const a = this.detailsAnalytics();
    if (!ev || !a) return;

    const items: ReportQueueItem[] = [];
    const now = Date.now();

    if (a.viewsTimeline.length > 0) {
      const imageUrl = this.captureAnalyticsChartHighRes();
      if (imageUrl) {
        items.push({
          id: now.toString(),
          title: `${ev.name} — ${this.ui.t('destinations.analytics.views_30d')}`,
          qtype: 'chart',
          imageUrl,
        });
      }
    }

    const rows: { label: string; value: number }[] = [
      { label: this.ui.t('destinations.analytics.saved_by_users'), value: a.savedByUsers },
      { label: this.ui.t('destinations.analytics.planner_users'),  value: a.plannerByUsers },
    ];
    if (a.topPlannerMonth) {
      rows.push({
        label: `${this.ui.t('destinations.analytics.top_planner_month')} (${this.plannerMonthLabel(a.topPlannerMonth)})`,
        value: a.topPlannerMonthCount,
      });
    }
    if (a.isMultiDay && a.topPlannerDate) {
      rows.push({
        label: `${this.ui.t('events.analytics.top_planner_date')} (${this.plannerDateLabel(a.topPlannerDate)})`,
        value: a.topPlannerDateCount,
      });
    }
    if (rows.length > 0) {
      items.push({
        id: (now + 1).toString(),
        title: `${ev.name} — ${this.ui.t('events.analytics.user_interest')}`,
        qtype: 'table',
        data: rows,
        colLabel: this.ui.t('events.analytics.metric'),
        colValue: this.ui.t('events.analytics.users'),
      });
    }

    appendToReportsQueue(items);
    this.closeDetailsPanel();
    void this.router.navigate(['/admin/reports']);
  }

  private captureAnalyticsChartHighRes(): string | null {
    const data = this.detailsAnalytics();
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

  protected closeDetailsPanel(): void {
    if (this.isPanelClosing()) return;
    this.isPanelClosing.set(true);
    this.analyticsChart?.destroy();
    this.analyticsChart = null;
    setTimeout(() => {
      this.selectedEvent.set(null);
      this.isPanelOpen.set(false);
      this.isPanelClosing.set(false);
      this.detailsInterests.set([]);
      this.detailsReviews.set([]);
      this.detailsAnalytics.set(null);
    }, 220);
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.update((current) => (current === id ? null : id));
  }

  protected openCreateDialog(): void {
    this.isCreateOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateClosing.set(true);
    setTimeout(() => { this.isCreateOpen.set(false); this.isCreateClosing.set(false); }, 220);
  }

  protected closeEditModal(): void {
    this.isEditClosing.set(true);
    setTimeout(() => { this.isEditOpen.set(false); this.isEditClosing.set(false); }, 220);
  }

  protected onEventCreated(row: EventRow): void {
    this.isCreateClosing.set(true);
    setTimeout(() => {
      this.isCreateOpen.set(false);
      this.isCreateClosing.set(false);
      const owner = this.isPlaceOwner();
      this.successMessage.set(owner ? 'Zahtev za događaj je podnet. Čeka se odobrenje.' : 'Interni događaj je uspešno kreiran.');
      this.patchFilter({ tab: owner ? 'pending' : 'active', search: '', typeId: null, cityId: null, destinationId: null, extraFilters: {}, page: 1 });
      this.filterDefs.set([]);
      this.currentPage.set(1);
      this.loadStats();
      this.loadEvents();
      setTimeout(() => this.successMessage.set(''), 4000);
    }, 220);
  }

  protected openEdit(): void {
    if (!this.selectedEvent()) return;
    this._editFromPanel = true;
    this.isEditOpen.set(true);
  }

  protected openEditFromRow(ev: EventRow): void {
    this._editFromPanel = false;
    this.selectedEvent.set(ev);
    this.isEditOpen.set(true);
  }

  protected openDeleteFromRow(ev: EventRow): void {
    this.selectedEvent.set(ev);
    this.initiateAction('delete');
  }

  protected restoreEvent(ev: EventRow): void {
    if (this.isRestoring()) return;
    this.isRestoring.set(true);
    this.subscription.add(
      this.eventsService.restoreEvent(ev.id)
        .pipe(finalize(() => this.isRestoring.set(false)))
        .subscribe({
          next: () => {
            this.selectedEvent.set(null);
            this.isPanelOpen.set(false);
            this.successMessage.set(this.ui.t('events.success.restored'));
            this.loadStats();
            this.loadEvents();
            setTimeout(() => this.successMessage.set(''), 4000);
          },
          error: (err) => {
            const msg = err?.error?.message;
            this.errorMessage.set(msg || this.ui.t('events.error.restore'));
            setTimeout(() => this.errorMessage.set(''), 4000);
          },
        }),
    );
  }

  protected openRenewModal(ev: EventRow): void {
    this.selectedEvent.set(ev);
    this.renewMode.set('nextYear');
    this.renewDateInput.set('');
    this.isRenewOpen.set(true);
  }

  protected closeRenewModal(): void {
    if (this.isRenewing()) return;
    this.isRenewOpen.set(false);
  }

  protected submitRenew(): void {
    const ev = this.selectedEvent();
    if (!ev || this.isRenewing()) return;

    const payload: { startDatetime?: string | null } = {};
    if (this.renewMode() === 'custom') {
      const input = this.renewDateInput();
      const selectedDate = input ? new Date(input) : null;
      if (!selectedDate || Number.isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
        this.errorMessage.set(this.ui.t('events.error.renew_future_date'));
        setTimeout(() => this.errorMessage.set(''), 4000);
        return;
      }
      payload.startDatetime = selectedDate.toISOString();
    }

    this.isRenewing.set(true);
    this.subscription.add(
      this.eventsService.renewEvent(ev.id, payload)
        .pipe(finalize(() => this.isRenewing.set(false)))
        .subscribe({
          next: () => {
            this.isRenewOpen.set(false);
            this.selectedEvent.set(null);
            this.isPanelOpen.set(false);
            this.successMessage.set(this.ui.t('events.success.renewed'));
            this.loadStats();
            this.loadEvents();
            setTimeout(() => this.successMessage.set(''), 4000);
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message ?? this.ui.t('events.error.renew'));
            setTimeout(() => this.errorMessage.set(''), 4000);
          },
        }),
    );
  }

  protected minRenewDateTimeLocal(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 1);
    return now.toISOString().slice(0, 16);
  }

  protected onEditSaved(row: EventRow): void {
    this.isEditClosing.set(true);
    // Optimistically patch the row in the loaded list so visible cells (incl. thumbnail) update immediately.
    this.events.update(list => list.map(item => {
      if (item.id !== row.id) return item;
      return { ...item, ...row, heroImageUrl: row.heroImageUrl ?? item.heroImageUrl };
    }));
    setTimeout(() => {
      this.isEditOpen.set(false);
      this.isEditClosing.set(false);
      this.selectedEvent.set(row);
      if (this._editFromPanel) {
        this.isPanelOpen.set(true);
      }
      this.successMessage.set(this.ui.t('events.success.saved'));
      this.loadEvents();
      setTimeout(() => this.successMessage.set(''), 4000);
    }, 220);
  }

  protected initiateAction(action: 'approve' | 'reject' | 'forward' | 'delete' | 'owner-approve' | 'owner-reject' | 'reactivate' | 'reforward'): void {
    this.confirmAction.set(action);
    this.rejectReason.set('');
    this.isConfirmOpen.set(true);
  }

  protected cancelAction(): void {
    this.confirmAction.set(null);
    this.isConfirmOpen.set(false);
  }

  protected confirmActionSubmit(): void {
    const action = this.confirmAction();
    const ev = this.selectedEvent();
    if (!action || !ev) return;

    if (action === 'delete') {
      this.isActioning.set(true);
      this.subscription.add(
        (ev.queueId && ev.status === 'pending'
          ? this.eventsService.deleteQueueRequest(ev.queueId)
          : this.eventsService.deleteEvent(ev.id))
          .pipe(finalize(() => this.isActioning.set(false)))
          .subscribe({
            next: () => {
              this.isConfirmOpen.set(false);
              this.confirmAction.set(null);
              this.selectedEvent.set(null);
              this.isPanelOpen.set(false);
              this.successMessage.set(this.ui.t('events.success.deleted'));
              this.loadStats();
              this.loadEvents();
              setTimeout(() => this.successMessage.set(''), 4000);
            },
            error: (err) => {
              this.errorMessage.set(err?.error?.message ?? this.ui.t('events.error.delete'));
              setTimeout(() => this.errorMessage.set(''), 4000);
            },
          }),
      );
      return;
    }

    this.isActioning.set(true);
    const targetId = ev.queueId ?? ev.id;
    const reason = this.rejectReason().trim();
    const obs =
      action === 'approve'
        ? this.eventsService.approveEvent(targetId)
        : action === 'reject'
          ? this.eventsService.rejectEvent(targetId, reason || 'Zahtev je odbijen od strane administratora.')
          : action === 'owner-approve'
            ? this.eventsService.ownerApproveEvent(targetId)
            : action === 'owner-reject'
              ? this.eventsService.ownerRejectEvent(targetId, reason || 'Vlasnik objekta je odbio organizaciju.')
              : action === 'reactivate'
                ? this.eventsService.reactivateEvent(ev.id)
                : action === 'reforward'
                  ? this.eventsService.reforwardEvent(ev.id)
                  : this.eventsService.forwardToOwner(targetId);

    this.subscription.add(
      obs.pipe(finalize(() => this.isActioning.set(false))).subscribe({
        next: () => {
          this.isConfirmOpen.set(false);
          this.confirmAction.set(null);
          this.selectedEvent.set(null);
          this.isPanelOpen.set(false);
          const msg = action === 'approve' ? 'Događaj je uspešno odobren.'
            : action === 'reject' ? 'Zahtev za događaj je odbijen.'
            : action === 'owner-approve' ? 'Prihvatili ste organizaciju događaja na vašem objektu.'
            : action === 'owner-reject' ? 'Odbili ste organizaciju događaja na vašem objektu.'
            : action === 'reactivate' ? 'Odbijeni događaj je uspešno odobren.'
            : action === 'reforward' ? 'Zahtev je prosleđen vlasniku objekta.'
            : 'Zahtev je prosleđen vlasniku.';
          this.successMessage.set(msg);
          this.loadStats();
          this.loadEvents();
          setTimeout(() => this.successMessage.set(''), 4000);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Došlo je do greške. Pokušajte ponovo.');
          setTimeout(() => this.errorMessage.set(''), 4000);
        },
      }),
    );
  }

  protected compactCount(n: number): string {
    return formatCompactCount(n);
  }

  protected rowKey(ev: EventRow): string {
    return ev.queueId ?? ev.id;
  }

  protected isSelected(ev: EventRow): boolean {
    if (!this.isPanelOpen() && !this.isEditOpen()) return false;
    const selected = this.selectedEvent();
    return selected?.id === ev.id;
  }

  protected priorityLabel(p: EventPriority | null): string {
    if (!p) return '—';
    return this.ui.t('events.priority.' + p);
  }

  protected typeLabel(typeId: number | null, t: EventType | null, typeName?: string | null): string {
    if (typeId != null) {
      const opt = this.eventTypeOptions().find(o => o.value === typeId);
      if (opt) return opt.label;
    }
    if (typeName) return typeName;
    if (!t) return '—';
    const map: Record<EventType, string> = {
      concert: 'Koncert', tasting: 'Degustacija', conference: 'Konferencija',
      sport: 'Sport', exhibition: 'Izložba', other: 'Ostalo',
    };
    return map[t] ?? '—';
  }

  /**
   * Activity-based pill: aktivno when someone clicked in the last 30 days OR
   * the event was created within that window (grace period). Source is the
   * backend-computed `hasRecentActivity` flag — keeps the rule consistent
   * with how the tourist app decides whether to show the event at all.
   */
  protected evtActivityStatus(ev: EventRow): 'active' | 'inactive' {
    return ev.hasRecentActivity ? 'active' : 'inactive';
  }

  protected typeIcon(t: EventType | null): string {
    if (!t) return 'event';
    const map: Record<EventType, string> = {
      concert: 'music_note', tasting: 'wine_bar', conference: 'business_center',
      sport: 'sports', exhibition: 'palette', other: 'event',
    };
    return map[t];
  }

  protected thumbColor(t: EventType | null): string {
    const map: Record<string, string> = {
      concert: '#7c3aed', tasting: '#b45309', conference: '#1d4ed8',
      sport: '#065f46', exhibition: '#9d174d', other: '#374151',
    };
    return map[t ?? 'other'] ?? '#374151';
  }

  protected statusLabel(s: string): string {
    const key = 'events.status.' + s;
    const translated = this.ui.t(key);
    return translated !== key ? translated : s;
  }

  protected statusTooltip(status: string): string {
    return this.ui.t('common.status.tooltip.' + status);
  }

  protected locationLabel(ev: EventRow): string {
    if (ev.address) return ev.address;
    const parts = [ev.venue, ev.city].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  protected formatDate(isoDate: string | null): string {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleDateString(this.dateLocale, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  protected formatDateRange(start: string | null, end: string | null): string {
    if (!start) return '—';
    const s = new Date(start).toLocaleDateString(this.dateLocale, { day: '2-digit', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString(this.dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  protected formatNumber(n: number | null): string {
    if (n === null) return '—';
    return n.toLocaleString(this.dateLocale);
  }

  protected formatRating(r: number): string {
    return r > 0 ? r.toFixed(1) : '—';
  }

  /** Human "pre N min/h/dana" from an ISO timestamp — used by the deleted tab
   *  to replace the status pill with a "when was it deleted" hint. */
  protected formatTimeAgo(value: string | null | undefined): string {
    if (!value) return '—';
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return '—';
    const minutes = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (minutes < 60) return this.ui.t('common.time_ago.min', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.ui.t('common.time_ago.hours',   { n: hours });
    const days = Math.floor(hours / 24);
    return this.ui.t('common.time_ago.days', { n: days });
  }

  protected starArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  protected formatPrice(n: number | null): string {
    if (n === null || n === 0) return this.ui.t('common.free');
    return `${n.toLocaleString(this.dateLocale)} RSD`;
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
    this.activeMenuId.set(null);
    this.isFilterOpen.set(false);
    if (this.isPanelOpen() && !this.isPanelClosing()) {
      const target = event.target as Element;
      if (!target.closest('.ddp-panel') && !target.closest('.evts-card')) {
        this.closeDetailsPanel();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isConfirmOpen()) return;
    if (this.isEditOpen()) { this.closeEditModal(); return; }
    if (this.isCreateOpen()) { this.closeCreateModal(); return; }
    if (this.isPanelOpen() && !this.isPanelClosing()) { this.closeDetailsPanel(); return; }
  }

  // ─── Calendar filter ────────────────────────────────────────────────
  get calendarMonthLabel(): string {
    return this.calendarViewDate.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' });
  }

  protected prevCalendarMonth(): void {
    this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() - 1, 1);
    this.loadCalendarMonth();
  }

  protected nextCalendarMonth(): void {
    this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() + 1, 1);
    this.loadCalendarMonth();
  }

  protected selectCalendarDate(cell: { date: Date; isCurrentMonth: boolean }): void {
    if (!cell.isCurrentMonth) return;
    const same = this.selectedCalendarDate && isSameDay(cell.date, this.selectedCalendarDate);
    this.selectedCalendarDate = same ? null : cell.date;
    const iso = this.selectedCalendarDate ? this.toIsoDate(this.selectedCalendarDate) : null;
    this.patchFilter({ selectedDate: iso, page: 1 });
    this.loadEvents();
  }

  protected isCalendarToday(date: Date): boolean { return isSameDay(date, new Date()); }
  protected isCalendarSelected(date: Date): boolean {
    return !!this.selectedCalendarDate && isSameDay(date, this.selectedCalendarDate);
  }
  protected trackByCalendarCell(_: number, c: { date: Date }): string { return c.date.toISOString(); }

  /**
   * Fetches all events for the currently viewed month, counts them per day, and
   * rebuilds the calendar grid. Mirrors the tourist app's calendar tab so the
   * admin gets the same per-day dot indicators next to the table.
   */
  private loadCalendarMonth(): void {
    const year  = this.calendarViewDate.getFullYear();
    const month = this.calendarViewDate.getMonth();
    const start = new Date(year, month, 1);
    const end   = new Date(year, month + 1, 0, 23, 59, 59, 999);

    let params = new HttpParams()
      .set('page', 1)
      .set('pageSize', 500)
      .set('startFrom', start.toISOString())
      .set('startTo',   end.toISOString());

    const tab = this.filters().tab;
    if (tab === 'active' || tab === 'expired') {
      this.subscription.add(
        this.http.get<{ total: number; items: { startDatetime?: string; startDate?: string }[] }>(
          '/api/admin/events',
          { params },
        ).subscribe({
          next: res => {
            this.calendarCounts = this.buildCountsFromItems(res.items, year, month);
            this.buildCalendarGrid();
          },
          error: () => {
            this.calendarCounts = new Map();
            this.buildCalendarGrid();
          },
        }),
      );
    } else {
      // Non-paged tabs (deleted/rejected/pending) — just skip the count load and
      // render an empty-dot grid; the date filter still applies if user picks one.
      this.calendarCounts = new Map();
      this.buildCalendarGrid();
    }
  }

  private buildCountsFromItems(
    items: { startDatetime?: string; startDate?: string }[],
    year: number,
    month: number,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const it of items) {
      const raw = it.startDatetime ?? it.startDate;
      if (!raw) continue;
      const d = new Date(raw);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = this.toIsoDate(d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  private buildCalendarGrid(): void {
    const year  = this.calendarViewDate.getFullYear();
    const month = this.calendarViewDate.getMonth();
    const lastDay  = new Date(year, month + 1, 0);
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first

    const cells: { date: Date; isCurrentMonth: boolean; count: number }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month, -i), isCurrentMonth: false, count: 0 });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      cells.push({ date, isCurrentMonth: true, count: this.calendarCounts.get(this.toIsoDate(date)) ?? 0 });
    }
    while (cells.length % 7 !== 0) {
      const n = cells.length - startOffset - lastDay.getDate() + 1;
      cells.push({ date: new Date(year, month + 1, n), isCurrentMonth: false, count: 0 });
    }
    this.calendarGrid = cells;
  }

  private toIsoDate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private patchFilter(patch: Partial<EventFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }

  private loadEvents(afterLoad?: (items: EventRow[]) => void): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.eventsService
        .getEvents(this.filters())
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (response) => {
            this.events.set(response.items);
            this.total.set(response.total);
            afterLoad?.(response.items);
            this.scrollToPendingRow();
          },
          error: () => {
            this.events.set([]);
            this.total.set(0);
            this.errorMessage.set('Učitavanje događaja nije uspelo.');
          },
        }),
    );
  }

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

  private loadEventsFuzzy(query: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const allFilters = { ...this.filters(), search: '', page: 1, pageSize: 500 };

    this.subscription.add(
      this.eventsService
        .getEvents(allFilters)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (response) => {
            const q = query.toLowerCase();
            const matched = response.items.filter(e =>
              this.fuzzyMatch(e.name.toLowerCase(), q) ||
              (e.organizer && this.fuzzyMatch(e.organizer.toLowerCase(), q)) ||
              (e.city && this.fuzzyMatch(e.city.toLowerCase(), q)) ||
              (e.type && this.fuzzyMatch(e.type.toLowerCase(), q)),
            );
            this.events.set(matched);
            this.total.set(matched.length);
          },
          error: () => {
            this.events.set([]);
            this.total.set(0);
            this.errorMessage.set('Učitavanje događaja nije uspelo.');
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
    this.subscription.add(
      this.eventsService.getStats().subscribe({
        next: (stats) => this.stats.set(stats),
        error: () => {},
      }),
    );
  }

  private loadFilterDefs(typeId: number): void {
    this.subscription.add(
      this.lookupService.getFilterDefinitions('event', typeId).subscribe({
        next: (defs) => this.filterDefs.set(defs),
        error: () => this.filterDefs.set([]),
      }),
    );
  }

  private loadFilterOptions(): void {
    const regionId = this.lockedRegionId() ?? undefined;
    this.subscription.add(
      this.eventsService.getEventTypes().subscribe({
        next: (r) => this.eventTypeOptions.set(r),
        error: () => this.eventTypeOptions.set([]),
      }),
    );
    this.subscription.add(
      this.eventsService.getCities(regionId).subscribe({
        next: (c) => this.cityOptions.set(c),
        error: () => this.cityOptions.set([]),
      }),
    );
    this.subscription.add(
      this.eventsService.getDestinations(regionId).subscribe({
        next: (d) => this.destinationOptions.set(d),
        error: () => this.destinationOptions.set([]),
      }),
    );
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
