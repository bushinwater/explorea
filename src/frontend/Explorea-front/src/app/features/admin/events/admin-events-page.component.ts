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
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { effect, untracked } from '@angular/core';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
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
    page: 1,
    pageSize: 20,
  });

  protected readonly filterDefs = signal<FilterDefinition[]>([]);

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

  protected readonly confirmAction = signal<'approve' | 'reject' | 'forward' | 'delete' | null>(null);
  protected readonly isConfirmOpen = signal(false);
  protected readonly isActioning = signal(false);
  protected readonly isRestoring = signal(false);
  protected readonly rejectReason = signal('');

  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly descriptionExpanded = signal(false);
  protected readonly detailsInterests = signal<InterestTagOption[]>([]);
  protected readonly detailsReviews   = signal<ReviewItem[]>([]);

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
    return 'Prosleđuj vlasniku?';
  });
  protected readonly confirmDesc = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve') return 'Organizator će biti obavešten da je njihov događaj odobren.';
    if (a === 'reject') return 'Ova akcija se ne može poništiti. Organizator će biti obavešten o odbijanju.';
    if (a === 'delete') return `Da li sigurno želiš da ukloniš događaj "${this.selectedEvent()?.name ?? ''}"? Događaj će biti premešten u sekciju "Obrisano" gde ostaje 30 dana pre trajnog brisanja.`;
    return 'Vlasnik objekta će dobiti zahtev za odobrenje.';
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
        if (openId) {
          const openName = params.get('openName') ?? '';
          this.openDetailsPanel({ id: openId, name: openName } as unknown as EventRow);
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
    this.loadEvents(openEditId ? (items) => {
      const ev = items.find(e => e.id === openEditId);
      if (ev) this.openEditFromRow(ev);
    } : undefined);
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
      page: 1,
      pageSize: f.pageSize,
    }));
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

  protected openDetailsPanel(event: EventRow): void {
    this.activeMenuId.set(null);
    this.descriptionExpanded.set(false);
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
  }

  protected closeDetailsPanel(): void {
    if (this.isPanelClosing()) return;
    this.isPanelClosing.set(true);
    setTimeout(() => {
      this.selectedEvent.set(null);
      this.isPanelOpen.set(false);
      this.isPanelClosing.set(false);
      this.detailsInterests.set([]);
      this.detailsReviews.set([]);
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
      this.successMessage.set('Interni događaj je uspešno kreiran.');
      this.patchFilter({ tab: 'active', search: '', typeId: null, cityId: null, destinationId: null, extraFilters: {}, page: 1 });
      this.filterDefs.set([]);
      this.currentPage.set(1);
      this.selectedEvent.set(row);
      this.isPanelOpen.set(true);
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
            this.successMessage.set('Događaj je vraćen.');
            this.loadStats();
            this.loadEvents();
            setTimeout(() => this.successMessage.set(''), 4000);
          },
          error: () => {
            this.errorMessage.set('Vraćanje nije uspelo.');
            setTimeout(() => this.errorMessage.set(''), 4000);
          },
        }),
    );
  }

  protected onEditSaved(row: EventRow): void {
    this.isEditClosing.set(true);
    setTimeout(() => {
      this.isEditOpen.set(false);
      this.isEditClosing.set(false);
      this.selectedEvent.set(row);
      if (this._editFromPanel) {
        this.isPanelOpen.set(true);
      }
      this.successMessage.set('Izmene su sačuvane.');
      this.loadEvents();
      setTimeout(() => this.successMessage.set(''), 4000);
    }, 220);
  }

  protected initiateAction(action: 'approve' | 'reject' | 'forward' | 'delete'): void {
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
        this.eventsService.deleteEvent(ev.id)
          .pipe(finalize(() => this.isActioning.set(false)))
          .subscribe({
            next: () => {
              this.isConfirmOpen.set(false);
              this.confirmAction.set(null);
              this.selectedEvent.set(null);
              this.isPanelOpen.set(false);
              this.successMessage.set('Događaj je obrisan.');
              this.loadStats();
              this.loadEvents();
              setTimeout(() => this.successMessage.set(''), 4000);
            },
            error: () => {
              this.errorMessage.set('Brisanje nije uspelo.');
              setTimeout(() => this.errorMessage.set(''), 4000);
            },
          }),
      );
      return;
    }

    this.isActioning.set(true);
    const targetId = ev.queueId ?? ev.id;
    const obs =
      action === 'approve'
        ? this.eventsService.approveEvent(targetId)
        : action === 'reject'
          ? this.eventsService.rejectEvent(targetId, this.rejectReason().trim() || 'Zahtev je odbijen od strane administratora.')
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
            : 'Zahtev je prosleđen vlasniku.';
          this.successMessage.set(msg);
          this.loadStats();
          this.loadEvents();
          setTimeout(() => this.successMessage.set(''), 4000);
        },
        error: () => {
          this.errorMessage.set('Došlo je do greške. Pokušajte ponovo.');
          setTimeout(() => this.errorMessage.set(''), 4000);
        },
      }),
    );
  }

  protected rowKey(ev: EventRow): string {
    return ev.queueId ?? ev.id;
  }

  protected isSelected(ev: EventRow): boolean {
    if (!this.isPanelOpen()) return false;
    const selected = this.selectedEvent();
    return selected?.id === ev.id && selected?.queueId === ev.queueId;
  }

  protected priorityLabel(p: EventPriority | null): string {
    if (!p) return '—';
    const map: Record<EventPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
    return map[p];
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

  protected evtActivityStatus(ev: EventRow): 'active' | 'inactive' {
    const end = ev.endDate ?? ev.startDate;
    const msSinceEnd = Date.now() - new Date(end).getTime();
    return msSinceEnd <= 30 * 24 * 60 * 60 * 1000 ? 'active' : 'inactive';
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
    const map: Record<string, string> = {
      pending: 'Čeka', active: 'Odobreno', rejected: 'Odbijeno', forwarded: 'Prosleđeno',
    };
    map['deleted'] = 'Obrisano';
    return map[s] ?? s;
  }

  protected locationLabel(ev: EventRow): string {
    const parts = [ev.venue, ev.city].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  protected formatDate(isoDate: string | null): string {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleDateString('sr-RS', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  protected formatDateRange(start: string | null, end: string | null): string {
    if (!start) return '—';
    const s = new Date(start).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  protected formatNumber(n: number | null): string {
    if (n === null) return '—';
    return n.toLocaleString('sr-RS');
  }

  protected formatRating(r: number): string {
    return r > 0 ? r.toFixed(1) : '—';
  }

  protected starArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  protected formatPrice(n: number | null): string {
    if (n === null || n === 0) return 'Besplatno';
    return `${n.toLocaleString('sr-RS')} RSD`;
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
          },
          error: () => {
            this.events.set([]);
            this.total.set(0);
            this.errorMessage.set('Učitavanje događaja nije uspelo.');
          },
        }),
    );
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
