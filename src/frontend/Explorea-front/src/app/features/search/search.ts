import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, takeUntil } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { Sidebar } from '../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../shared/bottom-nav/bottom-nav';
import { DestinationCard } from '../../shared/components/destination-card/destination-card';
import { EventCard } from '../../shared/components/event-card/event-card';
import { SearchService } from '../../core/services/search.service';
import { HomeService } from '../../core/services/home.service';
import { SearchItem } from '../../core/models/search.model';
import { HomeData } from '../../core/models/home.model';

const ENTITY_TABS = [
  { key: 'sve',         label: 'Sve',         icon: 'apps' },
  { key: 'destination', label: 'Destinacije', icon: 'landscape' },
  { key: 'place',       label: 'Mesta',       icon: 'store' },
  { key: 'activity',    label: 'Aktivnosti',  icon: 'directions_run' },
  { key: 'event',       label: 'Događaji',    icon: 'event' },
];

const CATEGORY_CHIPS = [
  { query: 'sve',        label: 'Sve',         icon: 'apps' },
  { query: 'destinacije', label: 'Destinacije', icon: 'landscape' },
  { query: 'mesta',       label: 'Mesta',       icon: 'store' },
  { query: 'aktivnosti',  label: 'Aktivnosti',  icon: 'directions_run' },
  { query: 'dogadjaji',   label: 'Događaji',    icon: 'event' },
];

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, Sidebar, BottomNav, DestinationCard, EventCard],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  query = '';
  activeChip = 'sve';
  activeTab = 'sve';
  results: SearchItem[] = [];
  loading = false;
  hasSearched = false;

  sortBy: 'popularity' | 'location' | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  homeData: HomeData | null = null;
  homeLoading = true;

  readonly entityTabs = ENTITY_TABS;
  readonly categoryChips = CATEGORY_CHIPS;
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private homeService: HomeService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.homeService.getHomeData().subscribe({
      next: data => {
        this.homeData = data;
        this.homeLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.homeLoading = false;
        this.cdr.detectChanges();
      },
    });

    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      tap(q => {
        if (q.trim().length < 2) {
          this.results = [];
          this.hasSearched = false;
          this.loading = false;
          this.cdr.detectChanges();
        } else {
          this.loading = true;
          this.cdr.detectChanges();
        }
      }),
      filter(q => q.trim().length >= 2),
      switchMap(q => this.searchService.search(q, 40)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: result => {
        this.results = result.results;
        this.hasSearched = true;
        this.loading = false;
        this.activeTab = 'sve';
        this.sortBy = null;
        this.sortDir = 'asc';
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /** Show home data when "Sve" chip is active and no search has been run */
  get showHomeContent(): boolean {
    return this.activeChip === 'sve' && !this.hasSearched && !this.loading;
  }

  /** Show results grid (loading skeleton or actual results) */
  get showResults(): boolean {
    return this.activeChip !== 'sve' || this.hasSearched || this.loading;
  }

  get filteredResults(): SearchItem[] {
    const base = this.activeTab === 'sve'
      ? this.results
      : this.results.filter(r => r.entityType === this.activeTab);

    if (this.sortBy === 'popularity') {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      return [...base].sort((a, b) => dir * ((a.entity.avgRating ?? 0) - (b.entity.avgRating ?? 0)));
    }
    return base;
  }

  countForTab(key: string): number {
    if (key === 'sve') return this.results.length;
    return this.results.filter(r => r.entityType === key).length;
  }

  onQueryChange() {
    if (this.query.trim().length >= 2) {
      this.activeChip = '';
    } else if (this.query.trim().length === 0) {
      this.activeChip = 'sve';
    }
    this.searchSubject.next(this.query);
  }

  setSortMode(key: 'popularity' | 'location') {
    if (this.sortBy === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = key;
      this.sortDir = 'asc';
    }
    this.cdr.detectChanges();
  }

  sortIcon(key: 'popularity' | 'location'): string {
    if (this.sortBy !== key) return '';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  clearQuery() {
    this.query = '';
    this.results = [];
    this.hasSearched = false;
    this.loading = false;
    this.activeChip = 'sve';
    this.cdr.detectChanges();
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0);
  }

  searchCategory(q: string) {
    this.activeChip = q;
    if (q === 'sve') {
      // Return to home content view
      this.query = '';
      this.results = [];
      this.hasSearched = false;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.query = q;
    this.cdr.detectChanges();
    this.searchSubject.next(q);
  }

  getEntityRoute(item: SearchItem): string[] {
    switch (item.entityType) {
      case 'destination': return ['/destinations', item.entity.slug];
      case 'place':       return ['/places',       item.entity.slug];
      case 'event':       return ['/events',        item.entity.slug];
      case 'activity':    return ['/activities',    item.entity.slug];
      default:            return ['/'];
    }
  }

  getTypeLabel(entityType: string): string {
    const map: Record<string, string> = {
      destination: 'Destinacija',
      place:       'Mesto',
      event:       'Događaj',
      activity:    'Aktivnost',
    };
    return map[entityType] ?? entityType;
  }

  getSubtitle(item: SearchItem): string {
    const e = item.entity;
    if (e.city?.name) return e.city.name;
    if (e.address)    return e.address;
    return '';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
