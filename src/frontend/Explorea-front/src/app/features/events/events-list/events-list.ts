import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, Subscription, forkJoin } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { EventCard } from '../../../shared/components/event-card/event-card';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { EventService } from '../../../core/services/event.service';
import { LocationService } from '../../../core/services/location.service';
import { AuthService } from '../../../core/services/auth.service';
import { PlannerService } from '../../../core/services/planner.service';
import {
  EventCard as EventCardModel,
  EventType,
  CalendarDay,
  CalendarCell,
} from '../../../core/models/event.model';
import { PlannerDot, PlannerEntry, PlannerEventRef } from '../../../core/models/planner.model';
import { ChatBubbleService } from '../../../core/services/chat-bubble.service';

type QuickFilter = 'all' | 'today' | 'weekend' | 'free';
type MobileView  = 'list' | 'calendar' | 'planner';
type SortMode    = 'date' | 'location' | 'popularity';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule,
            Sidebar, BottomNav, EventCard, DetailFooter],
  templateUrl: './events-list.html',
  styleUrl: './events-list.css',
})
export class EventsListPage implements OnInit, OnDestroy {
  mobileView: MobileView = 'list';

  allEvents: EventCardModel[] = [];
  filteredEvents: EventCardModel[] = [];
  events: EventCardModel[] = [];
  total = 0;
  loading = false;
  types: EventType[] = [];

  page = 1;
  hasMore = false;
  loadingMore = false;

  selectedTypeId: number | null = null;
  quickFilter: QuickFilter = 'all';
  searchQuery = '';
  sortMode: SortMode = 'date';
  sortDir: 'asc' | 'desc' = 'asc';

  private userLat: number | null = null;
  private userLng: number | null = null;
  locationAvailable = false;
  showLocationModal = false;
  locationModalLoading = false;
  locationModalBlocked = false;

  viewDate: Date = new Date(2026, 6, 1);
  selectedDate: Date | null = null;
  calendarDays: CalendarDay[] = [];
  calendarGrid: CalendarCell[] = [];

  // ─── Auth ──────────────────────────────────────────────────────
  isLoggedIn = false;

  // ─── Desktop calendar tab switcher ────────────────────────────
  desktopCalendarTab: 'filter' | 'planner' = 'filter';

  // ─── Planner calendar ──────────────────────────────────────────
  showPlannerSection   = false;
  plannerViewDate      = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  plannerDots: PlannerDot[]  = [];
  plannerGrid: CalendarCell[] = [];
  plannerSelectedDate: Date | null = null;
  plannerEntries: PlannerEntry[]   = [];
  plannerEntriesLoading            = false;

  // ─── Add-to-planner modal ─────────────────────────────────────
  showAddModal      = false;
  addModalRef: PlannerEventRef | null = null;
  addModalDays: { value: string; label: string }[] = [];
  addModalSelectedDays: string[] = [];
  addModalNote        = '';
  addModalSaving      = false;
  addModalSuccess     = false;
  addModalError       = '';

  readonly DAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

  private lockedScrollY = 0;
  private querySubject = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private eventService: EventService,
    private locationService: LocationService,
    private authService: AuthService,
    private plannerService: PlannerService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private chatBubbleService: ChatBubbleService,
  ) {}

  openAiRecommendation(): void {
    this.chatBubbleService.openWithMessage('Predloži mi događaje za ovaj vikend');
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();

    if (this.route.snapshot.queryParamMap.get('tab') === 'planner') {
      this.desktopCalendarTab = 'planner';
    }

    this.eventService.getTypes().subscribe(types => {
      this.types = types;
      this.cdr.detectChanges();
    });
    this.loadUserLocation();
    this.loadEvents();
    this.loadCalendar();

    if (this.isLoggedIn) {
      this.loadPlannerDots();
    }

    const searchSub = this.querySubject.pipe(
      debounceTime(120),
    ).subscribe(() => {
      this.applyFilters();
      this.cdr.detectChanges();
    });
    this.subs.add(searchSub);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.hasMore || this.loadingMore) return;
    const threshold = 250;
    const position = window.scrollY + window.innerHeight;
    const height = document.documentElement.scrollHeight;
    if (position >= height - threshold) {
      this.loadMore();
    }
  }

  // ─── Data ─────────────────────────────────────────────────────

  private loadUserLocation(): void {
    if (!this.locationService.isEnabled()) return;

    const cached = this.locationService.getCached();
    if (cached) {
      this.userLat = cached.lat;
      this.userLng = cached.lng;
      this.locationAvailable = true;
      return;
    }

    // Cache miss — ask browser (no new prompt if permission already granted)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLat = pos.coords.latitude;
          this.userLng = pos.coords.longitude;
          this.locationAvailable = true;
          if (this.sortMode === 'location') {
            this.applyFilters();
          }
          this.cdr.detectChanges();
        },
        () => { /* denied */ },
        { timeout: 5000, maximumAge: 60_000 },
      );
    }
  }

  loadEvents(): void {
    this.loading = true;
    const today = new Date();
    const params: any = { typeId: this.selectedTypeId };
    if (this.quickFilter === 'today')
      params.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    else if (this.quickFilter === 'weekend')
      params.weekend = true;
    else if (this.quickFilter === 'free')
      params.freeOnly = true;

    this.eventService.getEvents(params).subscribe(res => {
      this.allEvents = res.items;
      this.loading = false;
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

  loadCalendar(): void {
    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth() + 1;
    this.eventService.getCalendar(y, m).subscribe(days => {
      this.calendarDays = days;
      this.buildCalendarGrid();
      this.cdr.detectChanges();
    });
  }

  // ─── Filter + Sort ────────────────────────────────────────────

  applyFilters(): void {
    let items = [...this.allEvents];

    if (this.selectedDate) {
      const sel = this.selectedDate;
      items = items.filter(e => {
        const start = toDateOnly(new Date(e.startDatetime));
        const end   = toDateOnly(new Date(e.endDatetime));
        const selD  = toDateOnly(sel);
        return selD >= start && selD <= end;
      });
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(e =>
        fuzzyIncludes(q, e.name.toLowerCase()) ||
        fuzzyIncludes(q, (e.address ?? '').toLowerCase()) ||
        fuzzyIncludes(q, (e.city?.name ?? '').toLowerCase()) ||
        fuzzyIncludes(q, (e.type?.name ?? '').toLowerCase()),
      );
    }

    items = this.sort(items);

    this.filteredEvents = items;
    this.total = items.length;
    this.page = 1;
    this.paginateEvents();
  }

  private paginateEvents(): void {
    this.events = this.filteredEvents.slice(0, this.page * PAGE_SIZE);
    this.hasMore = this.events.length < this.filteredEvents.length;
  }

  loadMore(): void {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    this.cdr.detectChanges();
    // Small artificial delay so the loading indicator is visible
    setTimeout(() => {
      this.page++;
      this.paginateEvents();
      this.loadingMore = false;
      this.cdr.detectChanges();
    }, 400);
  }

  private sort(items: EventCardModel[]): EventCardModel[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    switch (this.sortMode) {
      case 'date':
        return [...items].sort((a, b) =>
          dir * (new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()),
        );

      case 'popularity':
        return [...items].sort((a, b) =>
          dir * ((a.popularity ?? 0) - (b.popularity ?? 0)),
        );

      case 'location':
        if (!this.locationAvailable) return items;
        return [...items].sort((a, b) => {
          const da = a.latitude != null && a.longitude != null
            ? haversine(this.userLat!, this.userLng!, a.latitude, a.longitude)
            : Infinity;
          const db = b.latitude != null && b.longitude != null
            ? haversine(this.userLat!, this.userLng!, b.latitude, b.longitude)
            : Infinity;
          return dir * (da - db);
        });
    }
  }

  // ─── Calendar ─────────────────────────────────────────────────

  buildCalendarGrid(): void {
    const year  = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = startOffset - 1; i >= 0; i--)
      cells.push({ date: new Date(year, month, -i), isCurrentMonth: false, count: 0 });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const apiDay = this.calendarDays.find(cd => {
        const p = new Date(cd.date);
        return p.getFullYear() === year && p.getMonth() === month && p.getDate() === d;
      });
      cells.push({ date, isCurrentMonth: true, count: apiDay?.count ?? 0 });
    }

    while (cells.length % 7 !== 0) {
      const n = cells.length - startOffset - lastDay.getDate() + 1;
      cells.push({ date: new Date(year, month + 1, n), isCurrentMonth: false, count: 0 });
    }

    this.calendarGrid = cells;
  }

  // ─── Interactions ─────────────────────────────────────────────

  selectType(typeId: number | null): void {
    this.selectedTypeId = typeId;
    this.selectedDate = null;
    this.loadEvents();
  }

  setQuickFilter(filter: QuickFilter): void {
    this.quickFilter = this.quickFilter === filter ? 'all' : filter;
    this.selectedDate = null;
    this.loadEvents();
  }

  setSortMode(mode: SortMode): void {
    if (mode === 'location' && !this.locationAvailable) {
      this.showLocationModal = true;
      this.cdr.detectChanges();
      return;
    }
    if (this.sortMode === mode) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortMode = mode;
      this.sortDir = 'asc';
    }
    this.applyFilters();
    this.cdr.detectChanges();
  }

  enableLocationFromModal(): void {
    this.locationModalBlocked = false;
    this.locationModalLoading = true;
    this.cdr.detectChanges();

    this.locationService.enable();

    if (!navigator.geolocation) {
      this.locationModalLoading = false;
      this.locationModalBlocked = true;
      this.cdr.detectChanges();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.locationAvailable = true;
        this.sortMode = 'location';
        this.sortDir = 'asc';
        this.locationModalLoading = false;
        this.showLocationModal = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      (err) => {
        this.locationModalLoading = false;
        // code 1 = PERMISSION_DENIED (blocked in browser settings)
        if (err.code === 1) {
          this.locationModalBlocked = true;
        } else {
          this.showLocationModal = false;
        }
        this.cdr.detectChanges();
      },
      { timeout: 10000 },
    );
  }

  dismissLocationModal(): void {
    this.showLocationModal = false;
    this.locationModalLoading = false;
    this.locationModalBlocked = false;
    this.cdr.detectChanges();
  }

  onQueryChange(q: string): void {
    this.searchQuery = q;
    this.querySubject.next(q);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  selectDate(cell: CalendarCell): void {
    if (!cell.isCurrentMonth) return;
    this.selectedDate = this.selectedDate && isSameDay(cell.date, this.selectedDate)
      ? null : cell.date;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  prevMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.loadCalendar();
  }

  nextMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.loadCalendar();
  }

  setMobileView(view: MobileView): void {
    this.mobileView = view;
    this.cdr.detectChanges();
  }

  // ─── Helpers ──────────────────────────────────────────────────

  get monthLabel(): string {
    return this.viewDate.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' });
  }

  get selectedDateLabel(): string {
    return this.selectedDate
      ? this.selectedDate.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long' })
      : '';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatTime(d: string): string {
    return new Date(d).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
  }

  eventLocationLabel(event: EventCardModel): string {
    return event.address || event.city?.name || 'Lokacija nije navedena';
  }

  sortIcon(mode: SortMode): string {
    if (this.sortMode !== mode) return '';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  isToday(date: Date): boolean    { return isSameDay(date, new Date()); }
  isSelected(date: Date): boolean { return !!this.selectedDate && isSameDay(date, this.selectedDate); }

  trackByEvent(_: number, e: EventCardModel): string { return e.id; }
  trackByCell(_: number, c: CalendarCell): string    { return c.date.toISOString(); }

  // ─── Planner section toggle ───────────────────────────────────

  togglePlannerSection(): void {
    this.showPlannerSection = !this.showPlannerSection;
    if (this.showPlannerSection) {
      this.buildPlannerGrid();
    }
    this.cdr.detectChanges();
  }

  // ─── Planner calendar ─────────────────────────────────────────

  loadPlannerDots(): void {
    const y = this.plannerViewDate.getFullYear();
    const m = this.plannerViewDate.getMonth() + 1;
    this.plannerService.getMonthDots(y, m).subscribe({
      next: dots => {
        this.plannerDots = dots;
        this.buildPlannerGrid();
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  buildPlannerGrid(): void {
    const year  = this.plannerViewDate.getFullYear();
    const month = this.plannerViewDate.getMonth();
    const firstDay   = new Date(year, month, 1);
    const lastDay    = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = startOffset - 1; i >= 0; i--)
      cells.push({ date: new Date(year, month, -i), isCurrentMonth: false, count: 0 });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date    = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dot     = this.plannerDots.find(p => p.date === dateStr);
      cells.push({ date, isCurrentMonth: true, count: dot?.count ?? 0 });
    }

    while (cells.length % 7 !== 0) {
      const n = cells.length - startOffset - lastDay.getDate() + 1;
      cells.push({ date: new Date(year, month + 1, n), isCurrentMonth: false, count: 0 });
    }

    this.plannerGrid = cells;
  }

  prevPlannerMonth(): void {
    this.plannerViewDate = new Date(this.plannerViewDate.getFullYear(), this.plannerViewDate.getMonth() - 1, 1);
    this.plannerSelectedDate = null;
    this.plannerEntries = [];
    this.loadPlannerDots();
  }

  nextPlannerMonth(): void {
    this.plannerViewDate = new Date(this.plannerViewDate.getFullYear(), this.plannerViewDate.getMonth() + 1, 1);
    this.plannerSelectedDate = null;
    this.plannerEntries = [];
    this.loadPlannerDots();
  }

  selectPlannerDate(cell: CalendarCell): void {
    if (!cell.isCurrentMonth) return;
    if (this.plannerSelectedDate && isSameDay(cell.date, this.plannerSelectedDate)) {
      this.plannerSelectedDate = null;
      this.plannerEntries = [];
      this.cdr.detectChanges();
      return;
    }
    this.plannerSelectedDate = cell.date;
    this.loadPlannerEntries(cell.date);
  }

  private loadPlannerEntries(date: Date): void {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    this.plannerEntriesLoading = true;
    this.plannerEntries = [];
    this.cdr.detectChanges();
    this.plannerService.getDayEntries(dateStr).subscribe({
      next: entries => {
        this.plannerEntries = entries;
        this.plannerEntriesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.plannerEntriesLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getEntryRoute(entry: { entityType: string; entitySlug: string }): string[] {
    switch (entry.entityType) {
      case 'destination': return ['/destinations', entry.entitySlug];
      case 'place':       return ['/places',       entry.entitySlug];
      case 'activity':    return ['/activities',   entry.entitySlug];
      default:            return ['/events',        entry.entitySlug];
    }
  }

  confirmDeleteId: string | null = null;
  confirmDeleteSaving = false;

  openDeleteConfirm(id: string): void {
    this.confirmDeleteId = id;
    this.confirmDeleteSaving = false;
    this.lockPageScroll();
    this.cdr.detectChanges();
  }

  cancelDeleteConfirm(): void {
    this.confirmDeleteId = null;
    this.unlockPageScroll();
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.confirmDeleteId || this.confirmDeleteSaving) return;
    this.confirmDeleteSaving = true;
    this.cdr.detectChanges();
    this.plannerService.removeEntry(this.confirmDeleteId).subscribe({
      next: () => {
        this.plannerEntries = this.plannerEntries.filter(e => e.id !== this.confirmDeleteId);
        this.confirmDeleteId = null;
        this.confirmDeleteSaving = false;
        this.unlockPageScroll();
        this.loadPlannerDots();
        this.cdr.detectChanges();
      },
      error: () => {
        this.confirmDeleteSaving = false;
        this.cdr.detectChanges();
      },
    });
  }

  removeEntry(id: string): void {
    this.plannerService.removeEntry(id).subscribe({
      next: () => {
        this.plannerEntries = this.plannerEntries.filter(e => e.id !== id);
        this.loadPlannerDots();
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  removeEntityFromAllDays(entityType: string, entityId: string): void {
    this.plannerService.removeAllEntriesForEntity(entityType, entityId).subscribe({
      next: () => {
        this.plannerEntries = this.plannerEntries.filter(e => !(e.entityType === entityType && e.entityId === entityId));
        this.loadPlannerDots();
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  removeAllEntries(): void {
    if (this.plannerEntries.length === 0) return;
    forkJoin(this.plannerEntries.map(e => this.plannerService.removeEntry(e.id))).subscribe({
      next: () => {
        this.plannerEntries = [];
        this.loadPlannerDots();
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  formatDateRange(start: string, end: string): string {
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    const same = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
    if (same) return s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  private lockPageScroll(): void {
    if (document.body.style.position === 'fixed') return;
    this.lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (document.body.style.position !== 'fixed') return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.lockedScrollY, behavior: 'instant' as ScrollBehavior });
  }

  isPlannerSelected(date: Date): boolean {
    return !!this.plannerSelectedDate && isSameDay(date, this.plannerSelectedDate);
  }

  get plannerMonthLabel(): string {
    return this.plannerViewDate.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' });
  }

  get plannerSelectedDateLabel(): string {
    return this.plannerSelectedDate
      ? this.plannerSelectedDate.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long' })
      : '';
  }

  // ─── Add-to-planner modal ─────────────────────────────────────

  openAddModal(ref: PlannerEventRef): void {
    this.addModalRef     = ref;
    this.addModalNote    = '';
    this.addModalSaving  = false;
    this.addModalSuccess = false;
    this.addModalError   = '';

    const days: { value: string; label: string }[] = [];
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const startRaw = ref.startDatetime ? new Date(ref.startDatetime) : null;
    const endRaw   = ref.endDatetime   ? new Date(ref.endDatetime)   : null;

    if (startRaw && !isNaN(startRaw.getTime())) {
      const endResolved = (endRaw && !isNaN(endRaw.getTime())) ? endRaw : startRaw;
      const cur    = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate());
      const endDay = new Date(endResolved.getFullYear(), endResolved.getMonth(), endResolved.getDate());
      while (cur <= endDay) {
        days.push({
          value: toDateStr(cur),
          label: cur.toLocaleDateString('sr-Latn-RS', { weekday: 'short', day: 'numeric', month: 'short' }),
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Fallback: if dates couldn't be parsed, default to today
    if (days.length === 0) {
      const today = new Date();
      days.push({
        value: toDateStr(today),
        label: today.toLocaleDateString('sr-Latn-RS', { weekday: 'short', day: 'numeric', month: 'short' }),
      });
    }

    this.addModalDays         = days;
    this.addModalSelectedDays = days.length > 0 ? [days[0].value] : [];
    this.showAddModal         = true;
    this.lockPageScroll();
    this.cdr.detectChanges();
  }

  cancelAddModal(): void {
    this.showAddModal = false;
    this.unlockPageScroll();
    this.cdr.detectChanges();
  }

  toggleAddModalDay(value: string): void {
    const idx = this.addModalSelectedDays.indexOf(value);
    this.addModalSelectedDays = idx >= 0
      ? this.addModalSelectedDays.filter(d => d !== value)
      : [...this.addModalSelectedDays, value];
  }

  confirmAddModal(): void {
    if (!this.addModalRef || this.addModalSaving) return;
    if (this.addModalSelectedDays.length === 0) {
      this.addModalError = 'Izaberi barem jedan dan.';
      this.cdr.detectChanges();
      return;
    }
    this.addModalSaving = true;
    this.addModalError  = '';
    this.cdr.detectChanges();

    const ref = this.addModalRef;
    forkJoin(
      this.addModalSelectedDays.map(d => this.plannerService.addEntry(ref.id, d, this.addModalNote))
    ).subscribe({
      next: () => {
        this.addModalSaving  = false;
        this.addModalSuccess = true;
        this.loadPlannerDots();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showAddModal = false;
          this.unlockPageScroll();
          this.cdr.detectChanges();
        }, 900);
      },
      error: (err) => {
        this.addModalSaving = false;
        this.addModalError  = err?.error?.message ?? 'Greška pri čuvanju. Pokušaj ponovo.';
        this.cdr.detectChanges();
      },
    });
  }
}

// ─── Pure helpers ──────────────────────────────────────────────

/**
 * Fuzzy substring match: returns true if query is found in target, or can be
 * found after a single common typing error (transposition of adjacent chars,
 * or deletion of one extra char the user inserted).
 * Queries shorter than 3 chars use exact substring only.
 */
function fuzzyIncludes(query: string, target: string): boolean {
  if (target.includes(query)) return true;
  if (query.length < 3) return false;

  // Allow one transposition of any two adjacent characters
  for (let i = 0; i < query.length - 1; i++) {
    const swapped =
      query.slice(0, i) + query[i + 1] + query[i] + query.slice(i + 2);
    if (target.includes(swapped)) return true;
  }

  // Allow one extra character (user typed an extra key)
  for (let i = 0; i < query.length; i++) {
    const deleted = query.slice(0, i) + query.slice(i + 1);
    if (target.includes(deleted)) return true;
  }

  return false;
}

function toDateOnly(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}


/** Haversine distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number { return deg * Math.PI / 180; }
