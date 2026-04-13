import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { EventCard } from '../../../shared/components/event-card/event-card';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { EventService } from '../../../core/services/event.service';
import { LocationService } from '../../../core/services/location.service';
import {
  EventCard as EventCardModel,
  EventType,
  CalendarDay,
  CalendarCell,
} from '../../../core/models/event.model';

type QuickFilter = 'all' | 'today' | 'weekend' | 'free';
type MobileView  = 'list' | 'calendar';
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
  filteredEvents: EventCardModel[] = [];  // after filters + sort, full list
  events: EventCardModel[] = [];          // paginated slice shown in template
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

  viewDate: Date = new Date(2026, 6, 1);
  selectedDate: Date | null = null;
  calendarDays: CalendarDay[] = [];
  calendarGrid: CalendarCell[] = [];

  readonly DAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

  private querySubject = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private eventService: EventService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.types = this.eventService.getTypes();
    this.loadUserLocation();
    this.loadEvents();
    this.loadCalendar();

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
    this.eventService.getEvents({
      typeId: this.selectedTypeId,
    }).subscribe(res => {
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

    if (this.quickFilter === 'today') {
      const today = new Date();
      items = items.filter(e => isSameDay(new Date(e.startDatetime), today));
    } else if (this.quickFilter === 'weekend') {
      items = items.filter(e => isWeekend(new Date(e.startDatetime)));
    } else if (this.quickFilter === 'free') {
      items = items.filter(e => !e.price);
    }

    if (this.selectedDate) {
      const sel = this.selectedDate;
      items = items.filter(e => isSameDay(new Date(e.startDatetime), sel));
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(e =>
        fuzzyIncludes(q, e.name.toLowerCase()) ||
        fuzzyIncludes(q, (e.address ?? '').toLowerCase()) ||
        fuzzyIncludes(q, e.city.name.toLowerCase()) ||
        fuzzyIncludes(q, e.type.name.toLowerCase()),
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
    this.applyFilters();
    this.cdr.detectChanges();
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
    this.showLocationModal = false;
    this.locationService.enable();
    if (!navigator.geolocation) { this.cdr.detectChanges(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.locationAvailable = true;
        this.sortMode = 'location';
        this.sortDir = 'asc';
        this.applyFilters();
        this.cdr.detectChanges();
      },
      () => { this.cdr.detectChanges(); },
      { timeout: 8000 },
    );
  }

  dismissLocationModal(): void {
    this.showLocationModal = false;
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

  sortIcon(mode: SortMode): string {
    if (this.sortMode !== mode) return '';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  isToday(date: Date): boolean    { return isSameDay(date, new Date()); }
  isSelected(date: Date): boolean { return !!this.selectedDate && isSameDay(date, this.selectedDate); }

  trackByEvent(_: number, e: EventCardModel): string { return e.id; }
  trackByCell(_: number, c: CalendarCell): string    { return c.date.toISOString(); }
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function isWeekend(d: Date): boolean { return d.getDay() === 0 || d.getDay() === 6; }

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
