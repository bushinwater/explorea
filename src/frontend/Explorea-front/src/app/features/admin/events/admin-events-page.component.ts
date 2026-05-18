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
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
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
} from './admin-events.models';
import { AdminEventsService } from './admin-events.service';
import { finalize } from 'rxjs';

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
    tab: 'pending',
    page: 1,
    pageSize: 8,
  });

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
  protected readonly confirmAction = signal<'approve' | 'reject' | 'forward' | null>(null);
  protected readonly isConfirmOpen = signal(false);
  protected readonly isActioning = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly isPanelOpen = computed(() => !!this.selectedEvent());
  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );
  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [f.typeId !== null, f.cityId !== null, f.destinationId !== null].filter(Boolean).length;
  });
  protected readonly confirmTitle = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve') return 'Odobriti zahtev za događaj?';
    if (a === 'reject') return 'Odbiti zahtev?';
    return 'Prosleđuj vlasniku?';
  });
  protected readonly confirmDesc = computed(() => {
    const a = this.confirmAction();
    if (a === 'approve') return 'Organizator će biti obavešten da je njihov događaj odobren.';
    if (a === 'reject')
      return 'Ova akcija se ne može poništiti. Organizator će biti obavešten o odbijanju.';
    return 'Vlasnik objekta će dobiti zahtev za odobrenje.';
  });

  constructor(
    private readonly eventsService: AdminEventsService,
    protected readonly authContext: AdminAuthContextService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.patchFilter({ search: value, page: 1 });
        this.loadEvents();
      }),
    );

    this.loadStats();
    this.loadFilterOptions();
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected setTab(tab: EventsTab): void {
    this.selectedEvent.set(null);
    this.patchFilter({ tab, page: 1 });
    this.loadEvents();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyType(typeId: number | null): void {
    this.patchFilter({ typeId, page: 1 });
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
      tab: f.tab,
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.loadEvents();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadEvents();
  }

  protected selectEvent(event: EventRow): void {
    this.activeMenuId.set(null);
    this.selectedEvent.set(event);
  }

  protected closePanel(): void {
    this.selectedEvent.set(null);
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.update((current) => (current === id ? null : id));
  }

  protected initiateAction(action: 'approve' | 'reject' | 'forward'): void {
    this.confirmAction.set(action);
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

    this.isActioning.set(true);
    const targetId = ev.queueId ?? ev.id;
    const obs =
      action === 'approve'
        ? this.eventsService.approveEvent(targetId)
        : action === 'reject'
          ? this.eventsService.rejectEvent(targetId)
          : this.eventsService.forwardToOwner(targetId);

    this.subscription.add(
      obs.subscribe({
        next: () => {
          this.isActioning.set(false);
          this.isConfirmOpen.set(false);
          this.confirmAction.set(null);
          this.selectedEvent.set(null);
          const msg =
            action === 'approve'
              ? 'Događaj je uspešno odobren.'
              : action === 'reject'
                ? 'Zahtev za događaj je odbijen.'
                : 'Zahtev je prosleđen vlasniku.';
          this.successMessage.set(msg);
          this.loadEvents();
          this.loadStats();
          setTimeout(() => this.successMessage.set(''), 4000);
        },
        error: () => {
          this.isActioning.set(false);
          this.errorMessage.set('Došlo je do greške. Pokušajte ponovo.');
          setTimeout(() => this.errorMessage.set(''), 4000);
        },
      }),
    );
  }

  protected priorityLabel(p: EventPriority | null): string {
    if (!p) return '—';
    const map: Record<EventPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
    return map[p];
  }

  protected typeLabel(t: EventType | null): string {
    if (!t) return '—';
    const map: Record<EventType, string> = {
      concert: 'Koncert',
      tasting: 'Degustacija',
      conference: 'Konferencija',
      sport: 'Sport',
      exhibition: 'Izložba',
      other: 'Ostalo',
    };
    return map[t];
  }

  protected typeIcon(t: EventType | null): string {
    if (!t) return 'event';
    const map: Record<EventType, string> = {
      concert: 'music_note',
      tasting: 'wine_bar',
      conference: 'business_center',
      sport: 'sports',
      exhibition: 'palette',
      other: 'event',
    };
    return map[t];
  }

  protected statusLabel(s: string): string {
    const map: Record<string, string> = {
      pending: 'Čeka',
      active: 'Odobreno',
      rejected: 'Odbijeno',
      forwarded: 'Prosleđeno',
    };
    return map[s] ?? s;
  }

  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected formatNumber(n: number | null): string {
    if (n === null) return '—';
    return n.toLocaleString('sr-RS');
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
    this.isFilterOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isConfirmOpen()) return;
    this.closePanel();
  }

  private patchFilter(patch: Partial<EventFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }

  private loadEvents(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.eventsService
        .getEvents(this.filters())
        .pipe(
          finalize(() => {
            this.isLoading.set(false);
          }),
        )
        .subscribe({
          next: (response) => {
            this.events.set(response.items);
            this.total.set(response.total);

            this.stats.update((stats) => {
              if (!stats) return stats;

              if (this.filters().tab === 'pending') {
                return {
                  ...stats,
                  tabPendingCount: response.total,
                  pendingApproval: response.total,
                };
              }

              if (this.filters().tab === 'active') {
                return { ...stats, tabActiveCount: response.total, activeRequests: response.total };
              }

              return stats;
            });
          },
          error: () => {
            this.events.set([]);
            this.total.set(0);
            this.errorMessage.set('Učitavanje događaja nije uspelo.');
          },
        }),
    );
  }

  private loadStats(): void {
    this.subscription.add(
      this.eventsService.getStats().subscribe({
        next: (stats) => this.stats.set(stats),
      }),
    );
  }

  private loadFilterOptions(): void {
    this.subscription.add(
      this.eventsService.getEventTypes().subscribe({
        next: (regions) => this.eventTypeOptions.set(regions),
        error: () => this.eventTypeOptions.set([]),
      }),
    );

    this.subscription.add(
      this.eventsService.getCities().subscribe({
        next: (cities) => this.cityOptions.set(cities),
        error: () => this.cityOptions.set([]),
      }),
    );

    this.subscription.add(
      this.eventsService.getDestinations().subscribe({
        next: (destinations) => this.destinationOptions.set(destinations),
        error: () => this.destinationOptions.set([]),
      }),
    );
  }
}
