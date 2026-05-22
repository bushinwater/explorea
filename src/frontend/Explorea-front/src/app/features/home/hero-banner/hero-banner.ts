import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, AfterViewInit,
  SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, takeUntil } from 'rxjs/operators';
import { HeroBanner as HeroBannerModel, CityFilter } from '../../../core/models/home.model';
import { SearchService } from '../../../core/services/search.service';
import { LocationService } from '../../../core/services/location.service';
import { LookupService, LookupItem, FilterDefinition } from '../../../core/services/lookup.service';
import { SearchItem } from '../../../core/models/search.model';
import { SearchFilters } from '../../../core/models/search-page.model';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './hero-banner.html',
  styleUrl: './hero-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBanner implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() banners: HeroBannerModel[] = [];
  @Input() cityFilters: CityFilter[] = [];
  @Input() set activeCityId(id: number | null) { this.selectedCityId = id; }
  @Output() citySelected = new EventEmitter<number | null>();
  @Output() searchSubmitted = new EventEmitter<string>();

  // [klon-poslednje, slide-0, slide-1, ..., slide-N, klon-prve]
  // trackIndex počinje od 1 (prva prava slika)
  trackIndex = 1;
  currentIndex = 0;       // za tačkice i tekst (0..N-1)
  noTransition = false;
  isTransitioning = false;

  selectedCityId: number | null = null;
  searchQuery = '';

  // live search
  searchResults: SearchItem[] = [];
  showDropdown = false;
  searchLoading = false;

  // ─── Filter panel ─────────────────────────────────────────────
  showFilterPanel    = false;
  draftFilters: SearchFilters = {};
  filters: SearchFilters      = {};
  filterEntityType: 'destination' | 'place' | 'activity' | 'event' | null = null;
  draftNearbyEnabled = false;
  nearbyEnabled      = false;

  draftEntityTypes: string[] = [];

  get isMultiEntityDraft(): boolean { return this.draftEntityTypes.length > 1; }

  // location
  locationAvailable    = false;
  showLocationModal    = false;
  locationModalLoading = false;
  locationModalBlocked = false;
  private userLat: number | null = null;
  private userLng: number | null = null;

  // lookups
  placeTypes:         LookupItem[] = [];
  activityCategories: LookupItem[] = [];
  eventTypes:         LookupItem[] = [];
  destinationTypes:   LookupItem[] = [];
  lookupsLoading = false;

  filterDefs:         FilterDefinition[] = [];
  filterDefsLoading  = false;
  private filterDefsTypeId: number | null = null;

  readonly filterEntityTypes = [
    { key: 'destination' as const, icon: 'landscape',      labelKey: 'SEARCH.TAB_DESTINATIONS' },
    { key: 'place'       as const, icon: 'store',          labelKey: 'SEARCH.TAB_PLACES' },
    { key: 'activity'    as const, icon: 'directions_run', labelKey: 'SEARCH.TAB_ACTIVITIES' },
    { key: 'event'       as const, icon: 'event',          labelKey: 'SEARCH.TAB_EVENTS' },
  ];

  private timer: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private searchService: SearchService,
    private locationService: LocationService,
    private lookupService: LookupService,
  ) {}

  ngOnInit() {
    this.loadUserLocation();
    this.loadLookups();

    this.searchSubject.pipe(
      debounceTime(50),
      distinctUntilChanged(),
      tap(q => {
        if (q.length < 2) {
          this.searchResults = [];
          this.showDropdown = false;
          this.searchLoading = false;
        } else {
          this.searchLoading = true;
        }
        this.cdr.markForCheck();
      }),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q, 8)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: result => {
        this.searchResults = result.results;
        this.showDropdown = result.results.length > 0;
        this.searchLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.searchLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['banners'] && this.banners.length && !this.timer) {
      this.startAutoAdvance();
    }
  }

  ngAfterViewInit() {
    if (this.banners.length && !this.timer) {
      this.startAutoAdvance();
    }
  }

  ngOnDestroy() {
    this.stopAutoAdvance();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get extendedSlides(): HeroBannerModel[] {
    if (!this.banners.length) return [];
    return [this.banners[this.banners.length - 1], ...this.banners, this.banners[0]];
  }

  get trackTranslate(): string {
    return `translateX(-${this.trackIndex * 100}%)`;
  }

  private startAutoAdvance() {
    this.timer = setInterval(() => {
      this.next();
      this.cdr.markForCheck();
    }, 5000);
  }

  private stopAutoAdvance() {
    if (this.timer) clearInterval(this.timer);
  }

  next() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex++;
    this.currentIndex = (this.trackIndex - 1) % this.banners.length;
  }

  prev() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex--;
    this.currentIndex = (this.trackIndex - 1 + this.banners.length) % this.banners.length;
  }

  goTo(index: number) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex = index + 1;
    this.currentIndex = index;
    this.stopAutoAdvance();
    this.startAutoAdvance();
  }

  onTransitionEnd() {
    this.isTransitioning = false;

    // Stigli smo na klon-prve (kraj) → instant skok na pravu prvu
    if (this.trackIndex === this.banners.length + 1) {
      this.noTransition = true;
      this.trackIndex = 1;
      this.currentIndex = 0;
      setTimeout(() => { this.noTransition = false; this.cdr.markForCheck(); }, 50);
    }

    // Stigli smo na klon-poslednje (početak) → instant skok na pravu poslednju
    if (this.trackIndex === 0) {
      this.noTransition = true;
      this.trackIndex = this.banners.length;
      this.currentIndex = this.banners.length - 1;
      setTimeout(() => { this.noTransition = false; this.cdr.markForCheck(); }, 50);
    }
  }

  selectCity(id: number | null) {
    this.selectedCityId = id;
    this.citySelected.emit(id);
  }

  onSearch() {
    this.showDropdown = false;
    this.router.navigate(['/search'], {
      state: {
        fromHero: true,
        query: this.searchQuery.trim(),
        filters: this.filters,
        nearbyEnabled: this.nearbyEnabled,
        filterEntityType: this.filterEntityType,
      },
    });
  }

  get hasActiveFilters(): boolean {
    const f = this.filters;
    return !!(
      this.nearbyEnabled ||
      f.minRating != null || f.minPrice != null || f.maxPrice != null ||
      f.openNow != null || f.radiusKm != null ||
      (f.placeTypeIds        ?? []).length > 0 ||
      (f.activityCategoryIds ?? []).length > 0 ||
      (f.eventTypeIds        ?? []).length > 0 ||
      (f.destinationTypeIds  ?? []).length > 0 ||
      Object.keys(f.extraFilters ?? {}).length > 0
    );
  }

  // ─── Filter panel ────────────────────────────────────────────

  openFilterPanel(): void {
    this.draftFilters       = { ...this.filters };
    this.draftNearbyEnabled = this.nearbyEnabled;
    this.draftEntityTypes   = this.filterEntityType ? [this.filterEntityType] : [];
    if (this.filterEntityType && this.filterEntityType !== 'activity') {
      const ids = this.getSelectedCategoryIds();
      if (ids.length === 1 && this.filterDefsTypeId !== ids[0]) this.loadFilterDefs(ids[0]);
    }
    this.showFilterPanel = true;
    this.cdr.markForCheck();
  }

  closeFilterPanel(): void {
    this.showFilterPanel = false;
    this.cdr.markForCheck();
  }

  applyFilters(): void {
    this.nearbyEnabled = this.draftNearbyEnabled;
    const f = { ...this.draftFilters };
    if (!this.nearbyEnabled) delete f.radiusKm;
    else if (!f.radiusKm) f.radiusKm = 50;
    this.filters         = f;
    this.showFilterPanel = false;

    let entityType: string | null = null;
    let activeEntityTypes: string[] | undefined;

    if (this.draftEntityTypes.length === 1) {
      entityType = this.draftEntityTypes[0];
      this.filterEntityType = entityType as 'destination' | 'place' | 'activity' | 'event';
    } else if (this.draftEntityTypes.length > 1) {
      activeEntityTypes = [...this.draftEntityTypes];
      this.filterEntityType = null;
    } else {
      this.filterEntityType = null;
    }

    this.router.navigate(['/search'], {
      state: {
        fromHero:          true,
        query:             this.searchQuery.trim(),
        filters:           this.filters,
        nearbyEnabled:     this.nearbyEnabled,
        filterEntityType:  entityType,
        activeEntityTypes: activeEntityTypes,
      },
    });
  }

  resetFilters(): void {
    this.draftFilters       = {};
    this.filters            = {};
    this.nearbyEnabled      = false;
    this.draftNearbyEnabled = false;
    this.filterEntityType   = null;
    this.draftEntityTypes   = [];
    this.filterDefs         = [];
    this.filterDefsTypeId   = null;
    this.showFilterPanel    = false;
    this.cdr.markForCheck();
  }

  toggleDraftEntityType(type: string): void {
    const idx = this.draftEntityTypes.indexOf(type);
    if (idx >= 0) {
      this.draftEntityTypes = this.draftEntityTypes.filter(t => t !== type);
    } else {
      this.draftEntityTypes = [...this.draftEntityTypes, type];
    }
    if (this.draftEntityTypes.length === 1) {
      const single = this.draftEntityTypes[0] as 'destination' | 'place' | 'activity' | 'event';
      this.filterEntityType = single;
      if (single !== 'destination') this.draftFilters = { ...this.draftFilters, destinationTypeIds: [] };
      if (single !== 'place')       this.draftFilters = { ...this.draftFilters, placeTypeIds: [] };
      if (single !== 'activity')    this.draftFilters = { ...this.draftFilters, activityCategoryIds: [] };
      if (single !== 'event')       this.draftFilters = { ...this.draftFilters, eventTypeIds: [] };
      this.draftFilters = { ...this.draftFilters, extraFilters: {} };
      this.filterDefs = [];
      this.filterDefsTypeId = null;
    } else if (this.draftEntityTypes.length > 1) {
      this.filterEntityType = null;
      this.draftFilters = { ...this.draftFilters, destinationTypeIds: [], placeTypeIds: [], activityCategoryIds: [], eventTypeIds: [], extraFilters: {} };
      this.filterDefs = [];
      this.filterDefsTypeId = null;
    } else {
      this.filterEntityType = null;
    }
    this.cdr.markForCheck();
  }

  getCategoriesForType(): LookupItem[] {
    switch (this.filterEntityType) {
      case 'destination': return this.destinationTypes;
      case 'place':       return this.placeTypes;
      case 'activity':    return this.activityCategories;
      case 'event':       return this.eventTypes;
      default:            return [];
    }
  }

  getSelectedCategoryIds(): number[] {
    switch (this.filterEntityType) {
      case 'destination': return this.draftFilters.destinationTypeIds ?? [];
      case 'place':       return this.draftFilters.placeTypeIds ?? [];
      case 'activity':    return this.draftFilters.activityCategoryIds ?? [];
      case 'event':       return this.draftFilters.eventTypeIds ?? [];
      default:            return [];
    }
  }

  isCategorySelected(id: number): boolean {
    return this.getSelectedCategoryIds().includes(id);
  }

  toggleCategory(id: number): void {
    const toggle = (arr: number[]) => {
      const idx = arr.indexOf(id);
      return idx >= 0 ? arr.filter(x => x !== id) : [...arr, id];
    };
    switch (this.filterEntityType) {
      case 'destination': {
        const newIds = toggle(this.draftFilters.destinationTypeIds ?? []);
        this.draftFilters = { ...this.draftFilters, destinationTypeIds: newIds, extraFilters: {} };
        if (newIds.length === 1) this.loadFilterDefs(newIds[0]);
        else { this.filterDefs = []; this.filterDefsTypeId = null; }
        break;
      }
      case 'place': {
        const newIds = toggle(this.draftFilters.placeTypeIds ?? []);
        this.draftFilters = { ...this.draftFilters, placeTypeIds: newIds, extraFilters: {} };
        if (newIds.length === 1) this.loadFilterDefs(newIds[0]);
        else { this.filterDefs = []; this.filterDefsTypeId = null; }
        break;
      }
      case 'activity':
        this.draftFilters = { ...this.draftFilters, activityCategoryIds: toggle(this.draftFilters.activityCategoryIds ?? []) };
        break;
      case 'event': {
        const newIds = toggle(this.draftFilters.eventTypeIds ?? []);
        this.draftFilters = { ...this.draftFilters, eventTypeIds: newIds, extraFilters: {} };
        if (newIds.length === 1) this.loadFilterDefs(newIds[0]);
        else { this.filterDefs = []; this.filterDefsTypeId = null; }
        break;
      }
    }
  }

  isExtraFilterActive(key: string, value: string = 'true'): boolean {
    return this.draftFilters.extraFilters?.[key] === value;
  }

  toggleExtraFilter(key: string, value: string = 'true'): void {
    const current = { ...(this.draftFilters.extraFilters ?? {}) };
    if (current[key] === value) delete current[key];
    else current[key] = value;
    this.draftFilters = { ...this.draftFilters, extraFilters: current };
  }

  loadFilterDefs(typeId: number): void {
    if (!this.filterEntityType || this.filterDefsTypeId === typeId) return;
    this.filterDefsLoading = true;
    this.filterDefsTypeId  = typeId;
    this.cdr.markForCheck();
    this.lookupService.getFilterDefinitions(this.filterEntityType, typeId).subscribe({
      next: defs => {
        this.filterDefs        = defs;
        this.filterDefsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.filterDefs        = [];
        this.filterDefsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleDraftNearby(): void {
    this.draftNearbyEnabled = !this.draftNearbyEnabled;
    if (this.draftNearbyEnabled) {
      if (!this.draftFilters.radiusKm) this.draftFilters = { ...this.draftFilters, radiusKm: 50 };
      if (!this.locationAvailable) this.requestLocationSilent();
    }
    this.cdr.markForCheck();
  }

  enableLocationFromModal(): void {
    this.locationModalBlocked = false;
    this.locationModalLoading = true;
    this.cdr.markForCheck();
    this.locationService.enable();
    if (!navigator.geolocation) {
      this.locationModalLoading = false;
      this.locationModalBlocked = true;
      this.cdr.markForCheck();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.userLat              = pos.coords.latitude;
        this.userLng              = pos.coords.longitude;
        this.locationAvailable    = true;
        this.locationModalLoading = false;
        this.showLocationModal    = false;
        this.cdr.markForCheck();
      },
      err => {
        this.locationModalLoading = false;
        this.locationModalBlocked = err.code === 1;
        if (err.code !== 1) this.showLocationModal = false;
        this.cdr.markForCheck();
      },
      { timeout: 10000 },
    );
  }

  dismissLocationModal(): void {
    this.showLocationModal    = false;
    this.locationModalLoading = false;
    this.locationModalBlocked = false;
    this.cdr.markForCheck();
  }

  // ─── Private helpers ─────────────────────────────────────────

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
          this.cdr.markForCheck();
        },
        () => {},
        { timeout: 5000, maximumAge: 60_000 },
      );
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    forkJoin({
      placeTypes:         this.lookupService.getPlaceTypes(),
      activityCategories: this.lookupService.getActivityCategories(),
      eventTypes:         this.lookupService.getEventTypes(),
      destinationTypes:   this.lookupService.getDestinationTypes(),
    }).subscribe({
      next: res => {
        this.placeTypes         = res.placeTypes;
        this.activityCategories = res.activityCategories;
        this.eventTypes         = res.eventTypes;
        this.destinationTypes   = res.destinationTypes;
        this.lookupsLoading     = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private requestLocationSilent(): void {
    if (!navigator.geolocation || !window.isSecureContext) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.userLat           = pos.coords.latitude;
        this.userLng           = pos.coords.longitude;
        this.locationAvailable = true;
        this.locationService.enable();
        this.cdr.markForCheck();
      },
      () => {},
      { timeout: 10000 },
    );
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (this.showDropdown && this.searchResults.length > 0) {
        this.onSelectResult(this.searchResults[0]);
      } else {
        this.onSearch();
      }
    }
    if (event.key === 'Escape') {
      this.showDropdown = false;
      this.cdr.markForCheck();
    }
  }

  onSearchInput(value: string) {
    if (value.length >= 2) {
      this.searchLoading = true;
      this.cdr.markForCheck();
    } else {
      this.searchResults = [];
      this.showDropdown = false;
      this.searchLoading = false;
      this.cdr.markForCheck();
    }
    this.searchSubject.next(value);
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showDropdown = false;
      this.cdr.markForCheck();
    }, 200);
  }

  onSelectResult(item: SearchItem) {
    this.showDropdown = false;
    this.searchQuery = item.entity.name;
    const routeMap: Record<string, string> = {
      destination: 'destinations',
      place: 'places',
      event: 'events',
      activity: 'activities',
    };
    this.router.navigate([`/${routeMap[item.entityType] ?? item.entityType}`, item.entity.slug]);
  }

  getEntityIcon(type: string): string {
    const icons: Record<string, string> = {
      destination: 'place',
      place: 'store',
      event: 'event',
      activity: 'directions_run',
    };
    return icons[type] ?? 'search';
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const diff = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) return;
    this.stopAutoAdvance();
    if (diff > 0) {
      this.next();
    } else {
      this.prev();
    }
    this.startAutoAdvance();
  }
}
