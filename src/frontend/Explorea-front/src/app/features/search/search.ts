import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild,
  ChangeDetectorRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { Sidebar } from '../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../shared/bottom-nav/bottom-nav';
import { SearchPageService } from '../../core/services/search-page.service';
import { SearchService } from '../../core/services/search.service';
import { LocationService } from '../../core/services/location.service';
import { LookupService, LookupItem } from '../../core/services/lookup.service';
import { SearchItem } from '../../core/models/search.model';
import {
  SearchPageAllResponse,
  SearchFilters,
} from '../../core/models/search-page.model';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Entity type tabs used in results view */
const ENTITY_TABS = [
  { key: 'sve',         icon: 'apps' },
  { key: 'destination', icon: 'landscape' },
  { key: 'place',       icon: 'store' },
  { key: 'activity',    icon: 'directions_run' },
  { key: 'event',       icon: 'event' },
];

/** Category chip row (same keys as entity tabs) */
const CATEGORY_CHIPS = [
  { key: 'sve',         icon: 'apps' },
  { key: 'destination', icon: 'landscape' },
  { key: 'place',       icon: 'store' },
  { key: 'activity',    icon: 'directions_run' },
  { key: 'event',       icon: 'event' },
];

const TAB_LABEL_KEYS: Record<string, string> = {
  sve:         'SEARCH.TAB_ALL',
  destination: 'SEARCH.TAB_DESTINATIONS',
  place:       'SEARCH.TAB_PLACES',
  activity:    'SEARCH.TAB_ACTIVITIES',
  event:       'SEARCH.TAB_EVENTS',
};

/** Frontend entity key → backend tab string for /api/search-page/list */
const TAB_TO_BACKEND: Record<string, string> = {
  destination: 'destination',
  place:       'places',
  activity:    'activities',
  event:       'events',
};

/** Frontend sort key → backend sortBy string */
const SORT_TO_BACKEND: Record<string, string> = {
  popularity: 'popularity',
  location:   'nearest',
};

const PAGE_SIZE       = 12;
const SCROLL_THRESHOLD = 300;

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  // ─── Query & state ─────────────────────────────────────────────
  query      = '';
  activeChip = 'sve';
  activeTab  = 'sve';

  // ─── Results ───────────────────────────────────────────────────
  allResults: SearchItem[] = [];
  loading     = false;
  loadingMore = false;
  hasSearched = false;
  pagination  = { page: 1, totalPages: 1, total: 0 };

  // ─── Idle content ──────────────────────────────────────────────
  allData: SearchPageAllResponse | null = null;
  allLoading = true;

  // ─── Sort ──────────────────────────────────────────────────────
  sortBy:  'popularity' | 'location' | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  // ─── Location ──────────────────────────────────────────────────
  private userLat: number | null = null;
  private userLng: number | null = null;
  locationAvailable    = false;
  showLocationModal    = false;
  locationModalLoading = false;
  locationModalBlocked = false;

  // ─── Filters ───────────────────────────────────────────────────
  showFilterPanel = false;
  /** Filter entity type — controls which category selectors are shown */
  filterEntityType: 'destination' | 'place' | 'activity' | 'event' | null = null;

  draftFilters: SearchFilters = {};
  filters: SearchFilters = {};

  // Lookup data for filter selectors
  placeTypes:           LookupItem[] = [];
  activityCategories:   LookupItem[] = [];
  eventTypes:           LookupItem[] = [];
  lookupsLoading = false;

  // ─── Static data ───────────────────────────────────────────────
  readonly entityTabs    = ENTITY_TABS;
  readonly categoryChips = CATEGORY_CHIPS;
  readonly tabLabelKeys  = TAB_LABEL_KEYS;
  readonly skeletons     = [1, 2, 3, 4, 5, 6];
  readonly idleSkeletons = [1, 2, 3, 4, 5];
  readonly ratingStars   = [1, 2, 3, 4, 5];

  readonly filterEntityTypes = [
    { key: 'destination' as const, icon: 'landscape',     labelKey: 'SEARCH.TAB_DESTINATIONS' },
    { key: 'place'       as const, icon: 'store',         labelKey: 'SEARCH.TAB_PLACES' },
    { key: 'activity'    as const, icon: 'directions_run',labelKey: 'SEARCH.TAB_ACTIVITIES' },
    { key: 'event'       as const, icon: 'event',         labelKey: 'SEARCH.TAB_EVENTS' },
  ];

  private readonly searchSubject = new Subject<void>();
  private readonly destroy$      = new Subject<void>();

  constructor(
    private searchPageService: SearchPageService,
    private searchService: SearchService,
    private locationService: LocationService,
    private lookupService: LookupService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadIdleContent();
    this.loadUserLocation();
    this.loadLookups();

    // Debounced free-text search — always uses /api/search (supports mixed types)
    this.searchSubject.pipe(
      debounceTime(350),
      takeUntil(this.destroy$),
    ).subscribe(() => this.executeSearch(1, false));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Infinite scroll ──────────────────────────────────────────────────────

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.showResults || !this.hasSearched || this.loading || this.loadingMore) return;
    if (this.pagination.page >= this.pagination.totalPages) return;
    const pos    = window.scrollY + window.innerHeight;
    const height = document.documentElement.scrollHeight;
    if (pos >= height - SCROLL_THRESHOLD) this.loadMore();
  }

  // ─── Idle content ─────────────────────────────────────────────────────────

  loadIdleContentPublic(): void { this.loadIdleContent(); }

  private loadIdleContent(): void {
    this.allLoading = true;
    const loc = this.locationService.getCached();
    this.searchPageService.getAll({
      userLat: loc?.lat,
      userLng: loc?.lng,
    }).subscribe({
      next: data => {
        this.allData    = data;
        this.allLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.allLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Lookups ──────────────────────────────────────────────────────────────

  private loadLookups(): void {
    this.lookupsLoading = true;
    forkJoin({
      placeTypes:         this.lookupService.getPlaceTypes(),
      activityCategories: this.lookupService.getActivityCategories(),
      eventTypes:         this.lookupService.getEventTypes(),
    }).subscribe({
      next: res => {
        this.placeTypes         = res.placeTypes;
        this.activityCategories = res.activityCategories;
        this.eventTypes         = res.eventTypes;
        this.lookupsLoading     = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.lookupsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Location ─────────────────────────────────────────────────────────────

  private loadUserLocation(): void {
    if (!this.locationService.isEnabled()) return;
    const cached = this.locationService.getCached();
    if (cached) {
      this.userLat           = cached.lat;
      this.userLng           = cached.lng;
      this.locationAvailable = true;
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userLat           = pos.coords.latitude;
          this.userLng           = pos.coords.longitude;
          this.locationAvailable = true;
          this.cdr.detectChanges();
        },
        () => {},
        { timeout: 5000, maximumAge: 60_000 },
      );
    }
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
      pos => {
        this.userLat              = pos.coords.latitude;
        this.userLng              = pos.coords.longitude;
        this.locationAvailable    = true;
        this.sortBy               = 'location';
        this.sortDir              = 'asc';
        this.locationModalLoading = false;
        this.showLocationModal    = false;
        this.triggerSearch();
        this.cdr.detectChanges();
      },
      err => {
        this.locationModalLoading = false;
        this.locationModalBlocked = err.code === 1;
        if (err.code !== 1) this.showLocationModal = false;
        this.cdr.detectChanges();
      },
      { timeout: 10000 },
    );
  }

  dismissLocationModal(): void {
    this.showLocationModal    = false;
    this.locationModalLoading = false;
    this.locationModalBlocked = false;
    this.cdr.detectChanges();
  }

  // ─── Search execution ─────────────────────────────────────────────────────

  private triggerSearch(): void {
    this.allResults = [];
    this.pagination = { page: 1, totalPages: 1, total: 0 };
    this.loading    = true;
    this.cdr.detectChanges();
    this.executeSearch(1, false);
  }

  /**
   * Routes to the correct backend endpoint:
   * - tab 'sve' (all types) → /api/search (existing full-text search, no pagination)
   * - specific tab         → /api/search-page/list (server-side sort/filter/pagination)
   */
  private executeSearch(page: number, append: boolean): void {
    if (this.activeTab === 'sve') {
      // Full-text search across all types, no pagination
      this.searchService.search(this.query.trim(), 40).subscribe({
        next: res => {
          this.allResults  = res.results;
          this.hasSearched = true;
          this.loading     = false;
          this.loadingMore = false;
          this.pagination  = { page: 1, totalPages: 1, total: res.total };
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading     = false;
          this.loadingMore = false;
          this.cdr.detectChanges();
        },
      });
      return;
    }

    // Specific tab — use search-page/list with server-side sort/filter/pagination
    const backendSortBy = this.sortBy ? SORT_TO_BACKEND[this.sortBy] : undefined;

    this.searchPageService.getList({
      tab:      TAB_TO_BACKEND[this.activeTab],
      query:    this.query.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy:   backendSortBy,
      userLat:  this.userLat  ?? undefined,
      userLng:  this.userLng  ?? undefined,
      ...this.filters,
    }).subscribe({
      next: res => {
        if (append) {
          this.allResults  = [...this.allResults, ...res.items];
          this.loadingMore = false;
        } else {
          this.allResults  = res.items;
          this.hasSearched = true;
          this.loading     = false;
        }
        this.pagination = {
          page:       res.pagination.page,
          totalPages: res.pagination.totalPages,
          total:      res.pagination.total,
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading     = false;
        this.loadingMore = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadMore(): void {
    if (this.loadingMore) return;
    this.loadingMore = true;
    this.cdr.detectChanges();
    this.executeSearch(this.pagination.page + 1, true);
  }

  // ─── Template getters ─────────────────────────────────────────────────────

  get showHomeContent(): boolean {
    return this.activeChip === 'sve' && !this.hasSearched && !this.loading;
  }

  get showResults(): boolean {
    return this.activeChip !== 'sve' || this.hasSearched || this.loading;
  }

  get filteredResults(): SearchItem[] {
    if (this.activeTab === 'sve') return this.allResults;
    return this.allResults.filter(r => r.entityType === this.activeTab);
  }

  get hasMore(): boolean {
    return this.pagination.page < this.pagination.totalPages;
  }

  get hasActiveFilters(): boolean {
    const f = this.filters;
    return !!(
      f.minRating != null || f.minPrice != null || f.maxPrice != null ||
      f.openNow != null || f.radiusKm != null ||
      (f.placeTypeIds        ?? []).length > 0 ||
      (f.activityCategoryIds ?? []).length > 0 ||
      (f.eventTypeIds        ?? []).length > 0
    );
  }

  countForTab(key: string): number {
    if (key === 'sve') return this.pagination.total;
    return this.allResults.filter(r => r.entityType === key).length;
  }

  // ─── Filter entity type helpers ───────────────────────────────────────────

  getCategoriesForType(): LookupItem[] {
    switch (this.filterEntityType) {
      case 'place':    return this.placeTypes;
      case 'activity': return this.activityCategories;
      case 'event':    return this.eventTypes;
      default:         return [];
    }
  }

  /** Subcategory chips shown inline below chips-row when a specific chip is active */
  getSubcatsForActiveChip(): LookupItem[] {
    switch (this.activeChip) {
      case 'place':    return this.placeTypes;
      case 'activity': return this.activityCategories;
      case 'event':    return this.eventTypes;
      default:         return [];
    }
  }

  isSubcatSelected(id: number): boolean {
    switch (this.activeChip) {
      case 'place':    return (this.filters.placeTypeIds        ?? []).includes(id);
      case 'activity': return (this.filters.activityCategoryIds ?? []).includes(id);
      case 'event':    return (this.filters.eventTypeIds        ?? []).includes(id);
      default:         return false;
    }
  }

  quickToggleSubcat(id: number): void {
    const toggle = (arr: number[]) => {
      const idx = arr.indexOf(id);
      return idx >= 0 ? arr.filter(x => x !== id) : [...arr, id];
    };
    switch (this.activeChip) {
      case 'place':
        this.filters = { ...this.filters, placeTypeIds: toggle(this.filters.placeTypeIds ?? []) };
        break;
      case 'activity':
        this.filters = { ...this.filters, activityCategoryIds: toggle(this.filters.activityCategoryIds ?? []) };
        break;
      case 'event':
        this.filters = { ...this.filters, eventTypeIds: toggle(this.filters.eventTypeIds ?? []) };
        break;
    }
    if (this.showResults) this.triggerSearch();
    this.cdr.detectChanges();
  }

  getSelectedCategoryIds(): number[] {
    switch (this.filterEntityType) {
      case 'place':    return this.draftFilters.placeTypeIds ?? [];
      case 'activity': return this.draftFilters.activityCategoryIds ?? [];
      case 'event':    return this.draftFilters.eventTypeIds ?? [];
      default:         return [];
    }
  }

  toggleCategory(id: number): void {
    const toggle = (arr: number[]) => {
      const idx = arr.indexOf(id);
      return idx >= 0 ? arr.filter(x => x !== id) : [...arr, id];
    };
    switch (this.filterEntityType) {
      case 'place':
        this.draftFilters = { ...this.draftFilters, placeTypeIds: toggle(this.draftFilters.placeTypeIds ?? []) };
        break;
      case 'activity':
        this.draftFilters = { ...this.draftFilters, activityCategoryIds: toggle(this.draftFilters.activityCategoryIds ?? []) };
        break;
      case 'event':
        this.draftFilters = { ...this.draftFilters, eventTypeIds: toggle(this.draftFilters.eventTypeIds ?? []) };
        break;
    }
  }

  isCategorySelected(id: number): boolean {
    return this.getSelectedCategoryIds().includes(id);
  }

  setFilterEntityType(type: 'destination' | 'place' | 'activity' | 'event' | null): void {
    if (this.filterEntityType === type) {
      this.filterEntityType = null;
    } else {
      this.filterEntityType = type;
      // Clear category selections from other types
      if (type !== 'place')    this.draftFilters = { ...this.draftFilters, placeTypeIds: [] };
      if (type !== 'activity') this.draftFilters = { ...this.draftFilters, activityCategoryIds: [] };
      if (type !== 'event')    this.draftFilters = { ...this.draftFilters, eventTypeIds: [] };
    }
    this.cdr.detectChanges();
  }

  /** How many subcategory chips to show inline before showing the "+N more" button */
  private readonly SUBCATS_PREVIEW_COUNT = 10;

  get subcatsPreview(): LookupItem[] {
    return this.getSubcatsForActiveChip().slice(0, this.SUBCATS_PREVIEW_COUNT);
  }

  get subcatsHiddenCount(): number {
    return Math.max(0, this.getSubcatsForActiveChip().length - this.SUBCATS_PREVIEW_COUNT);
  }

  // ─── User interactions ────────────────────────────────────────────────────

  onQueryChange(): void {
    if (this.query.trim().length === 0) {
      this.activeChip  = 'sve';
      this.activeTab   = 'sve';
      this.allResults  = [];
      this.hasSearched = false;
      this.loading     = false;
      this.pagination  = { page: 1, totalPages: 1, total: 0 };
      this.cdr.detectChanges();
      return;
    }
    if (this.query.trim().length < 2) return;
    this.activeChip = '';
    this.loading    = true;
    this.cdr.detectChanges();
    this.searchSubject.next();
  }

  clearQuery(): void {
    this.query       = '';
    this.activeChip  = 'sve';
    this.activeTab   = 'sve';
    this.allResults  = [];
    this.hasSearched = false;
    this.loading     = false;
    this.pagination  = { page: 1, totalPages: 1, total: 0 };
    this.cdr.detectChanges();
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0);
  }

  searchCategory(key: string): void {
    this.activeChip = key;
    this.activeTab  = key;
    if (key === 'sve') {
      this.query            = '';
      this.allResults       = [];
      this.hasSearched      = false;
      this.loading          = false;
      this.pagination       = { page: 1, totalPages: 1, total: 0 };
      this.filterEntityType = null;
      this.cdr.detectChanges();
      return;
    }
    // Auto-sync filter entity type with the selected chip and clear stale category filters
    this.filterEntityType = key as 'destination' | 'place' | 'activity' | 'event';
    this.filters = {
      ...this.filters,
      placeTypeIds: key === 'place' ? (this.filters.placeTypeIds ?? []) : [],
      activityCategoryIds: key === 'activity' ? (this.filters.activityCategoryIds ?? []) : [],
      eventTypeIds: key === 'event' ? (this.filters.eventTypeIds ?? []) : [],
    };
    this.query            = '';
    this.hasSearched      = true;
    this.triggerSearch();
  }

  setActiveTab(tab: string): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (this.showResults) this.triggerSearch();
  }

  setSortMode(key: 'popularity' | 'location'): void {
    if (key === 'location' && !this.locationAvailable) {
      this.showLocationModal = true;
      this.cdr.detectChanges();
      return;
    }
    if (this.sortBy === key) {
      // Second click deselects the sort
      this.sortBy  = null;
      this.sortDir = 'asc';
    } else {
      this.sortBy  = key;
      this.sortDir = 'asc';
    }
    if (this.showResults) this.triggerSearch();
    this.cdr.detectChanges();
  }

  sortIcon(key: 'popularity' | 'location'): string {
    if (this.sortBy !== key) return '';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // ─── Filter panel ─────────────────────────────────────────────────────────

  openFilterPanel(): void {
    this.draftFilters = { ...this.filters };
    // Sync entity type from active chip when opening panel
    if (this.activeChip !== 'sve' && this.activeChip !== '') {
      this.filterEntityType = this.activeChip as 'destination' | 'place' | 'activity' | 'event';
    }
    this.showFilterPanel = true;
    this.cdr.detectChanges();
  }

  closeFilterPanel(): void {
    this.showFilterPanel = false;
    this.cdr.detectChanges();
  }

  applyFilters(): void {
    this.filters          = { ...this.draftFilters };
    this.showFilterPanel  = false;
    if (this.showResults) this.triggerSearch();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.draftFilters     = {};
    this.filters          = {};
    this.filterEntityType = null;
    this.showFilterPanel  = false;
    if (this.showResults) this.triggerSearch();
    this.cdr.detectChanges();
  }

  // ─── Routing helpers ──────────────────────────────────────────────────────

  getEntityRoute(item: SearchItem): string[] {
    switch (item.entityType) {
      case 'destination': return ['/destinations', item.entity.slug];
      case 'place':       return ['/places',       item.entity.slug];
      case 'event':       return ['/events',        item.entity.slug];
      case 'activity':    return ['/activities',    item.entity.slug];
      default:            return ['/'];
    }
  }

  getSubtitle(item: SearchItem): string {
    const e = item.entity;
    if (e.city?.name) return e.city.name;
    if (e.address)    return e.address;
    return '';
  }

  trackByItem(_: number, item: SearchItem): string {
    return item.entity.id;
  }
}
