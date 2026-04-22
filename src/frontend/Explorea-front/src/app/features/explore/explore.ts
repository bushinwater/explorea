import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, takeUntil } from 'rxjs/operators';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Sidebar } from '../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../shared/bottom-nav/bottom-nav';
import { ExploreService, ExploreMarker } from '../../core/services/explore.service';
import { SearchService } from '../../core/services/search.service';
import { LookupService, LookupItem, FilterDefinition } from '../../core/services/lookup.service';
import { SearchItem } from '../../core/models/search.model';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const DARK = {
  land:             '#1e2e24',
  water:            '#102840',
  park:             '#1e3228',
  road_major:       '#486858',
  road_minor:       '#364e40',
  road_path:        '#2c4436',
  building:         '#253828',
  building_outline: '#30503c',
  extrusion:        '#5a9e78',
  boundary:         '#335244',
  text:             '#c8d8cc',
  text_halo:        '#182818',
  sand:             '#262614',
  pedestrian:       '#283e30',
  surface:          '#243a2c',
  bridge:           '#2e4c3a',
  icon:             '#8aab96',
};

const LIGHT = {
  land:             '#eef1ec',
  water:            '#6bb0d4',
  park:             '#96c89c',
  road_major:       '#ffffff',
  road_minor:       '#f5f8f4',
  road_path:        '#deeadc',
  building:         '#ccd8c8',
  building_outline: '#b0c4ac',
  extrusion:        '#a2dcad',
  boundary:         '#6b826b',
  text:             '#1a3828',
  text_halo:        '#eef1ec',
  sand:             '#e0d8b0',
  pedestrian:       '#dce8d8',
  surface:          '#e4eee0',
  bridge:           '#d8e4d4',
  icon:             '#28694c',
};

// Frontend display key → backend entity type value
const ENTITY_TYPE_BACKEND_MAP: Record<string, string> = {
  'destinacije': 'destination',
  'objekti':     'place',
  'aktivnosti':  'activity',
  'dogadjaji':   'event',
};

const ENTITY_TYPES = [
  { key: 'destinacije', labelKey: 'EXPLORE.ENTITY_TYPES.DESTINATIONS', icon: 'landscape' },
  { key: 'objekti',     labelKey: 'EXPLORE.ENTITY_TYPES.PLACES',       icon: 'store' },
  { key: 'aktivnosti',  labelKey: 'EXPLORE.ENTITY_TYPES.ACTIVITIES',   icon: 'directions_run' },
  { key: 'dogadjaji',   labelKey: 'EXPLORE.ENTITY_TYPES.EVENTS',       icon: 'event' },
];

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './explore.html',
  styleUrl: './explore.css',
})
export class Explore implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @ViewChild('drawerScroll') drawerScrollRef!: ElementRef;

  constructor(
    private cdr: ChangeDetectorRef,
    private exploreService: ExploreService,
    private searchService: SearchService,
    private lookupService: LookupService,
    private translate: TranslateService,
  ) {}

  // ── Real-time drag state for mobile bottom sheet ──────────────
  drawerTranslateY = 9999;
  isDraggingSheet = false;
  private sheetReady = false;
  private sheetTouchStartY = 0;
  private sheetStartTranslate = 0;
  private contentTouchStartY = 0;
  @HostListener('window:resize')
  onResize(): void {
    this.drawerTranslateY = this.collapsedTranslate;
    this.cdr.detectChanges();
  }

  private get collapsedTranslate(): number {
    const bottomNavHeight = window.innerWidth <= 768 ? 64 : 0;
    // 80dvh u CSS-u = window.innerHeight * 0.8 (dvh prati window.innerHeight)
    const sheetHeight = window.innerHeight * 0.8;
    const peekHeight = 110; // samo handle bar + "N rezultata" tekst
    return Math.max(0, sheetHeight - bottomNavHeight - peekHeight);
  }

  get sheetStyle(): { [key: string]: string } {
    return {
      transform: `translateY(${this.drawerTranslateY}px)`,
      transition: (this.isDraggingSheet || !this.sheetReady) ? 'none' : 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  get pinPopupBottom(): number {
    if (window.innerWidth > 768) return 24; // desktop: ~var(--spacing-lg)
    // Sheet: position absolute bottom:0, height 80dvh, translateY(drawerTranslateY)
    // Popup bottom = visible sheet height from explore-main bottom + 20px gap
    return window.innerHeight * 0.8 - this.drawerTranslateY + 20;
  }

  map!: MapLibreMap;
  markers: Marker[] = [];
  private themeObserver!: MutationObserver;
  private lightStyle: any = null;
  private darkStyle: any = null;

  // State
  selectedPin: ExploreMarker | null = null;
  drawerExpanded = false;
  filterPanelVisible = window.innerWidth > 768;
  loading = false;
  currentZoom = 7;

  // Filters
  nearbyOnly = true;
  radiusKm = 25;
  selectedEntityTypes: string[] = [];
  openNowOnly = false;
  minRating: number | null = null;
  entityTypes = ENTITY_TYPES;

  // Subcategory filters (server-side)
  selectedSubcatIds: number[] = [];
  placeTypes: LookupItem[] = [];
  activityCategories: LookupItem[] = [];
  eventTypes: LookupItem[] = [];
  destinationTypes: LookupItem[] = [];

  // Price range filter
  minPrice: number | null = null;
  maxPrice: number | null = null;

  // Dynamic extra attribute filters (loaded when single place type selected)
  filterDefs: FilterDefinition[] = [];
  filterDefsLoading = false;
  private filterDefsTypeId: number | null = null;
  extraFilters: Record<string, string> = {};

  // User location (fetched when nearbyOnly = true)
  userLat: number | null = null;
  userLng: number | null = null;

  // API data
  pins: ExploreMarker[] = [];
  visiblePins: ExploreMarker[] = [];
  visiblePinsCount = 0;

  // Route navigation
  showLocationModal = false;
  private pendingRoutePin: ExploreMarker | null = null;

  // Search
  searchQuery = '';
  searchResults: SearchItem[] = [];
  showSearchDropdown = false;
  searchLoading = false;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  get sliderStyle(): { [key: string]: string } {
    const pct = ((this.radiusKm - 5) / 195) * 100;
    return {
      background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
    };
  }

  private get zoomVisibleTypes(): string[] {
    if (this.currentZoom < 8)  return ['destination'];
    if (this.currentZoom < 11) return ['destination', 'event', 'activity'];
    return ['destination', 'event', 'activity', 'place'];
  }

  get filteredPins(): ExploreMarker[] {
    // If user explicitly picked types, respect their selection (skip zoom filter)
    if (this.selectedEntityTypes.length > 0) {
      const backendTypes = this.selectedEntityTypes.map(k => ENTITY_TYPE_BACKEND_MAP[k]);
      return this.pins.filter(p => backendTypes.includes(p.entityType));
    }
    // Otherwise show only what makes sense at this zoom level
    const visible = this.zoomVisibleTypes;
    return this.pins.filter(p => visible.includes(p.entityType));
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.selectedEntityTypes.length > 0) count++;
    if (this.openNowOnly) count++;
    if (this.minRating !== null) count++;
    if (this.nearbyOnly && this.radiusKm !== 25) count++;
    if (this.selectedSubcatIds.length > 0) count++;
    if (this.minPrice !== null || this.maxPrice !== null) count++;
    if (Object.keys(this.extraFilters).length > 0) count++;
    return count;
  }

  get showPriceRange(): boolean {
    return this.selectedEntityTypes.some(k => k === 'objekti' || k === 'dogadjaji');
  }

  isEntityTypeSelected(key: string): boolean {
    return this.selectedEntityTypes.includes(key);
  }

  toggleEntityType(key: string) {
    const idx = this.selectedEntityTypes.indexOf(key);
    if (idx >= 0) {
      this.selectedEntityTypes.splice(idx, 1);
    } else {
      this.selectedEntityTypes.push(key);
    }
    // Clear subcategory + extra filters when entity type mix changes
    this.selectedSubcatIds = [];
    this.extraFilters = {};
    this.filterDefs = [];
    this.filterDefsTypeId = null;
    this.addMarkers();
  }

  toggleFilterPanel() {
    this.filterPanelVisible = !this.filterPanelVisible;
  }

  async toggleNearbyOnly() {
    this.nearbyOnly = !this.nearbyOnly;
    if (this.nearbyOnly && this.userLat === null) {
      await this.requestGeolocation();
    }
    this.fetchMarkers();
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  ngAfterViewInit() {
    document.documentElement.classList.add('no-scroll');
    document.body.classList.add('no-scroll');
    this.drawerTranslateY = this.collapsedTranslate;
    this.cdr.detectChanges();
    setTimeout(() => { this.sheetReady = true; this.cdr.detectChanges(); }, 50);
    this.initMap();
    this.watchTheme();
    this.attachContentTouchListeners();
    this.loadMarkers();
    this.initSearch();
    this.loadLookups();
  }

  private initSearch() {
    this.searchSubject.pipe(
      debounceTime(30),
      distinctUntilChanged(),
      tap(q => {
        if (q.length < 2) {
          this.searchResults = [];
          this.showSearchDropdown = false;
          this.searchLoading = false;
          this.cdr.detectChanges();
        } else {
          this.searchLoading = true;
          this.cdr.detectChanges();
        }
      }),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q, 8)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: result => {
        this.searchResults = result.results;
        this.showSearchDropdown = result.results.length > 0;
        this.searchLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.searchLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadLookups(): void {
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
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadFilterDefs(typeId: number): void {
    if (this.filterDefsTypeId === typeId) return;
    this.filterDefsLoading = true;
    this.filterDefsTypeId  = typeId;
    this.cdr.detectChanges();
    this.lookupService.getFilterDefinitions('place', typeId).subscribe({
      next: defs => {
        this.filterDefs        = defs;
        this.filterDefsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.filterDefs        = [];
        this.filterDefsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  isExtraFilterActive(key: string, value: string = 'true'): boolean {
    return this.extraFilters[key] === value;
  }

  toggleExtraFilter(key: string, value: string = 'true'): void {
    const current = { ...this.extraFilters };
    if (current[key] === value) {
      delete current[key];
    } else {
      current[key] = value;
    }
    this.extraFilters = current;
  }

  /**
   * Returns the single entity-type key that has subcategories available,
   * only when exactly one of (objekti / aktivnosti / dogadjaji) is in the selection.
   * Returns null when 0 or 2+ of those types are selected.
   */
  get subcatEntityType(): string | null {
    const withSubcats = this.selectedEntityTypes.filter(
      k => k === 'destinacije' || k === 'objekti' || k === 'aktivnosti' || k === 'dogadjaji',
    );
    return withSubcats.length === 1 ? withSubcats[0] : null;
  }

  get subcatsToShow(): LookupItem[] {
    switch (this.subcatEntityType) {
      case 'destinacije': return this.destinationTypes;
      case 'objekti':     return this.placeTypes;
      case 'aktivnosti':  return this.activityCategories;
      case 'dogadjaji':   return this.eventTypes;
      default:            return [];
    }
  }

  get showExtraFilters(): boolean {
    return this.subcatEntityType === 'objekti' && this.selectedSubcatIds.length === 1;
  }

  isSubcatSelected(id: number): boolean {
    return this.selectedSubcatIds.includes(id);
  }

  toggleSubcat(id: number): void {
    const idx = this.selectedSubcatIds.indexOf(id);
    if (idx >= 0) {
      this.selectedSubcatIds.splice(idx, 1);
    } else {
      this.selectedSubcatIds.push(id);
    }
    // Clear extra filters when subcat changes
    this.extraFilters = {};
    this.filterDefs = [];
    this.filterDefsTypeId = null;
    // Load extra filter defs when exactly one place type selected
    if (this.subcatEntityType === 'objekti' && this.selectedSubcatIds.length === 1) {
      this.loadFilterDefs(this.selectedSubcatIds[0]);
    }
    this.fetchMarkers();
  }

  onSearchInput(value: string) {
    this.searchSubject.next(value);
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.showSearchDropdown = false;
      this.cdr.detectChanges();
    }
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  onSelectSearchResult(item: SearchItem) {
    this.showSearchDropdown = false;
    this.searchQuery = item.entity.name;
    this.cdr.detectChanges();

    // Prvo traži u već učitanim pinovima
    const existing = this.pins.find(
      p => p.entityType === item.entityType && p.slug === item.entity.slug,
    );

    if (existing) {
      this.flyToPin(existing);
      return;
    }

    // Nije u učitanim pinovima — fetch koordinata
    this.exploreService.getMarkerBySlug(item.entityType, item.entity.slug).subscribe({
      next: marker => {
        // Dodaj u listu ako već nije tu
        if (!this.pins.find(p => p.entityType === marker.entityType && p.slug === marker.slug)) {
          this.pins = [...this.pins, marker];
        }
        this.flyToPin(marker);
      },
      error: () => { /* tiho ignorisi */ },
    });
  }

  private flyToPin(pin: ExploreMarker) {
    this.selectedPin = pin;
    // Collapse the bottom sheet so the pin popup is fully visible.
    this.drawerExpanded = false;
    this.drawerTranslateY = this.collapsedTranslate;
    this.map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(this.map.getZoom(), 12), duration: 900 });
    this.cdr.detectChanges();
  }

  getSearchIcon(type: string): string {
    const icons: Record<string, string> = {
      destination: 'landscape',
      place: 'store',
      event: 'event',
      activity: 'directions_run',
    };
    return icons[type] ?? 'search';
  }

  private async loadMarkers() {
    if (this.nearbyOnly) {
      await this.requestGeolocation();
    }
    this.fetchMarkers();
  }

  private requestGeolocation(): Promise<void> {
    return new Promise(resolve => {
      if (!navigator.geolocation || !window.isSecureContext) {
        // Keep nearbyOnly = true so the hint "location unavailable" is shown,
        // but markers will be fetched without location filter (userLat stays null).
        this.cdr.detectChanges();
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userLat = pos.coords.latitude;
          this.userLng = pos.coords.longitude;
          resolve();
        },
        () => {
          // Denied or unavailable — keep nearbyOnly true so the hint shows.
          this.cdr.detectChanges();
          resolve();
        },
        { timeout: 10000 },
      );
    });
  }

  fetchMarkers() {
    this.loading = true;
    this.cdr.detectChanges();

    const params: any = { radius: this.radiusKm, limit: 500 };
    if (this.nearbyOnly && this.userLat !== null && this.userLng !== null) {
      params.lat = this.userLat;
      params.lng = this.userLng;
    }
    if (this.minRating !== null) params.minRating = this.minRating;
    if (this.openNowOnly) params.openNow = true;
    if (this.minPrice !== null) params.minPrice = this.minPrice;
    if (this.maxPrice !== null) params.maxPrice = this.maxPrice;
    if (Object.keys(this.extraFilters).length > 0) params.extraFilters = this.extraFilters;

    if (this.subcatEntityType === 'objekti' && this.selectedSubcatIds.length > 0)
      params.placeTypeIds = this.selectedSubcatIds;
    else if (this.subcatEntityType === 'aktivnosti' && this.selectedSubcatIds.length > 0)
      params.activityCategoryIds = this.selectedSubcatIds;
    else if (this.subcatEntityType === 'dogadjaji' && this.selectedSubcatIds.length > 0)
      params.eventTypeIds = this.selectedSubcatIds;
    else if (this.subcatEntityType === 'destinacije' && this.selectedSubcatIds.length > 0)
      params.destinationTypeIds = this.selectedSubcatIds;

    this.exploreService.getMapMarkers(params).subscribe({
      next: result => {
        this.pins = result.markers;
        this.loading = false;
        this.addMarkers();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private attachContentTouchListeners() {
    const el = this.drawerScrollRef?.nativeElement;
    if (!el) return;
    el.addEventListener('touchmove', (e: TouchEvent) => this.onContentTouchMove(e), { passive: false });
  }

  private watchTheme() {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        this.add3DBuildings();
        this.addMarkers();
      });
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private luminance(hex: string): number {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return 0;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r * 0.299 + g * 0.587 + b * 0.114;
  }

  private buildThemedStyle(base: any, p: typeof DARK & typeof LIGHT): any {
    const themed = JSON.parse(JSON.stringify(base));

    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      const type: string = layer.type ?? '';

      if (!layer.paint) return layer;

      delete layer.paint['fill-pattern'];

      switch (type) {
        case 'background':
          layer.paint['background-color'] = p.land;
          break;

        case 'fill': {
          if (/building/.test(id)) {
            layer.paint['fill-opacity'] = 0;
            break;
          }

          let fillColor: string;
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) {
            fillColor = p.water;
            layer.paint['fill-outline-color'] = p.water;
          } else if (/forest|wood|orchard|scrub|grass|meadow|park|nature|garden|vegetation|landcover/.test(id)) {
            fillColor = p.park;
            if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park;
          } else if (/landuse/.test(id)) {
            fillColor = p.park;
          } else if (/sand|beach|desert|bare/.test(id)) {
            fillColor = p.sand;
          } else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) {
            fillColor = p.pedestrian;
            if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian;
          } else if (/bridge/.test(id)) {
            fillColor = p.bridge;
          } else {
            const orig = typeof layer.paint['fill-color'] === 'string'
              ? layer.paint['fill-color'] : '';
            fillColor = this.luminance(orig) > 128 ? p.surface : p.land;
          }

          layer.paint['fill-color'] = fillColor;
          break;
        }

        case 'line': {
          let lineColor: string;
          if (/water|river|stream|canal|lake/.test(id)) {
            lineColor = p.water;
          } else if (/motorway|trunk/.test(id)) {
            lineColor = p.road_major;
          } else if (/primary|secondary|tertiary|road|street|residential|service/.test(id)) {
            lineColor = p.road_minor;
          } else if (/path|track|foot|cycle|pedestrian/.test(id)) {
            lineColor = p.road_path;
          } else if (/boundary|admin|border/.test(id)) {
            lineColor = p.boundary;
          } else if (/bridge/.test(id)) {
            lineColor = p.bridge;
          } else if (/casing|outline/.test(id)) {
            lineColor = p.land;
          } else {
            const orig = typeof layer.paint['line-color'] === 'string'
              ? layer.paint['line-color'] : '';
            lineColor = this.luminance(orig) > 128 ? p.road_minor : p.land;
          }
          layer.paint['line-color'] = lineColor;
          break;
        }

        case 'fill-extrusion':
          layer.paint['fill-extrusion-color'] = p.extrusion;
          layer.paint['fill-extrusion-opacity'] = 1;
          break;

        case 'symbol':
          layer.paint['text-color'] = p.text;
          if (layer.paint['text-halo-color']) layer.paint['text-halo-color'] = p.text_halo;
          if (layer.paint['icon-color']) layer.paint['icon-color'] = p.icon;
          break;
      }

      return layer;
    });

    return themed;
  }

  private async initMap() {
    const res = await fetch(MAP_STYLE_URL);
    const base = await res.json();
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [20.45, 44.0],
      zoom: 7,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left',
    );

    this.map.on('load', () => {
      this.add3DBuildings();
      this.addMarkers();
    });

    this.map.on('zoomend', () => {
      const newZoom = this.map.getZoom();
      // Only re-render if crossing a threshold (avoids pointless marker rebuilds)
      const tier = (z: number) => z < 8 ? 0 : z < 11 ? 1 : 2;
      if (tier(newZoom) !== tier(this.currentZoom)) {
        this.currentZoom = newZoom;
        this.addMarkers();
        this.cdr.detectChanges();
      } else {
        this.currentZoom = newZoom;
      }
    });

    this.map.on('moveend', () => {
      this.updateVisibleCount();
    });

    this.map.on('click', e => {
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest('.map-pin-btn')) {
        this.selectedPin = null;
        this.cdr.detectChanges();
      }
    });
  }

  private add3DBuildings() {
    const style = this.map.getStyle();
    if (!style?.layers) return;

    const buildingLayer = style.layers.find(
      l => l.id.includes('building') && (l as any).type === 'fill',
    ) as any;

    if (!buildingLayer || this.map.getLayer('3d-buildings')) return;

    const source = buildingLayer.source;
    const sourceLayer = buildingLayer['source-layer'];
    if (!source || !sourceLayer) return;

    const palette = this.isDark ? DARK : LIGHT;

    this.map.setLight({
      anchor: 'viewport',
      color: '#ffffff',
      intensity: this.isDark ? 0.25 : 0.4,
    });

    this.map.addLayer(
      {
        id: '3d-buildings',
        type: 'fill-extrusion',
        source,
        'source-layer': sourceLayer,
        minzoom: 14,
        paint: {
          'fill-extrusion-color': palette.extrusion,
          'fill-extrusion-height': [
            'max',
            ['coalesce', ['get', 'height'], ['*', ['coalesce', ['get', 'levels'], 2], 3.5]],
            5,
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 1,
        },
      },
      buildingLayer.id,
    );
  }

  private updateVisibleCount(): void {
    if (!this.map) {
      this.visiblePins      = this.filteredPins;
      this.visiblePinsCount = this.filteredPins.length;
      this.cdr.detectChanges();
      return;
    }
    try {
      const bounds          = this.map.getBounds();
      this.visiblePins      = this.filteredPins.filter(p => bounds.contains([p.lng, p.lat]));
      this.visiblePinsCount = this.visiblePins.length;
    } catch {
      this.visiblePins      = this.filteredPins;
      this.visiblePinsCount = this.filteredPins.length;
    }
    this.cdr.detectChanges();
  }

  private addMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers = [];

    this.filteredPins.forEach(pin => {
      const el = document.createElement('div');
      el.className = 'map-pin-btn';
      const icon = this.getPinIcon(pin.entityType);
      el.innerHTML = `
        <div class="pin-bubble">
          <span class="material-icons">${icon}</span>
        </div>
        <div class="pin-label">${pin.name}</div>
      `;
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.flyToPin(pin);
        this.map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(this.map.getZoom(), 10), duration: 800 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(this.map);

      this.markers.push(marker);
    });

    this.updateVisibleCount();
  }

  getPinIcon(entityType: string): string {
    switch (entityType) {
      case 'destination': return 'landscape';
      case 'place':       return 'store';
      case 'activity':    return 'directions_run';
      case 'event':       return 'event';
      default:            return 'location_on';
    }
  }

  getPinRoute(pin: ExploreMarker): string[] {
    switch (pin.entityType) {
      case 'destination': return ['/destinations', pin.slug];
      case 'place':       return ['/places', pin.slug];
      case 'activity':    return ['/activities', pin.slug];
      case 'event':       return ['/events', pin.slug];
      default:            return ['/'];
    }
  }

  getEntityTypeLabel(entityType: string): string {
    const keys: Record<string, string> = {
      'destination': 'EXPLORE.ENTITY_LABELS.DESTINATION',
      'place':       'EXPLORE.ENTITY_LABELS.PLACE',
      'activity':    'EXPLORE.ENTITY_LABELS.ACTIVITY',
      'event':       'EXPLORE.ENTITY_LABELS.EVENT',
    };
    const key = keys[entityType];
    return key ? this.translate.instant(key) : entityType;
  }

  applyFilters() {
    this.fetchMarkers();
  }

  resetFilters() {
    this.nearbyOnly = true;
    this.radiusKm = 25;
    this.selectedEntityTypes = [];
    this.openNowOnly = false;
    this.minRating = null;
    this.selectedSubcatIds = [];
    this.minPrice = null;
    this.maxPrice = null;
    this.extraFilters = {};
    this.filterDefs = [];
    this.filterDefsTypeId = null;
    this.fetchMarkers();
  }

  setMinRating(val: number | null) {
    this.minRating = this.minRating === val ? null : val;
  }

  toggleDrawer() {
    this.drawerExpanded = !this.drawerExpanded;
    this.drawerTranslateY = this.drawerExpanded ? 0 : this.collapsedTranslate;
    if (this.drawerExpanded && this.selectedPin) {
      this.selectedPin = null;
    }
  }

  // ── Handle drag ──────────────────────────────────────────────
  onHandleTouchStart(e: TouchEvent) {
    this.isDraggingSheet = true;
    this.sheetTouchStartY = e.touches[0].clientY;
    this.sheetStartTranslate = this.drawerTranslateY;
    if (this.selectedPin) {
      this.selectedPin = null;
    }
    this.cdr.detectChanges();
  }

  onHandleTouchMove(e: TouchEvent) {
    if (!this.isDraggingSheet) return;
    const deltaY = e.touches[0].clientY - this.sheetTouchStartY;
    this.drawerTranslateY = Math.max(0, Math.min(this.collapsedTranslate, this.sheetStartTranslate + deltaY));
    this.cdr.detectChanges();
  }

  onHandleTouchEnd(e: TouchEvent) {
    if (!this.isDraggingSheet) return;
    this.isDraggingSheet = false;
    const mid = this.collapsedTranslate / 2;
    if (this.drawerTranslateY <= mid) {
      this.drawerExpanded = true;
      this.drawerTranslateY = 0;
    } else {
      this.drawerExpanded = false;
      this.drawerTranslateY = this.collapsedTranslate;
    }
    this.cdr.detectChanges();
  }

  // ── Content drag (close from scroll-top) ─────────────────────
  onContentTouchStart(e: TouchEvent) {
    this.contentTouchStartY = e.touches[0].clientY;
    this.sheetStartTranslate = this.drawerTranslateY;
  }

  onContentTouchMove(e: TouchEvent) {
    const scrollTop = this.drawerScrollRef?.nativeElement?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    const deltaY = e.touches[0].clientY - this.contentTouchStartY;
    if (deltaY <= 0) return;
    e.preventDefault();
    this.isDraggingSheet = true;
    this.drawerTranslateY = Math.min(this.collapsedTranslate, deltaY);
    this.cdr.detectChanges();
  }

  onContentTouchEnd(e: TouchEvent) {
    if (!this.isDraggingSheet) return;
    this.isDraggingSheet = false;
    const mid = this.collapsedTranslate / 2;
    if (this.drawerTranslateY <= mid) {
      this.drawerExpanded = true;
      this.drawerTranslateY = 0;
    } else {
      this.drawerExpanded = false;
      this.drawerTranslateY = this.collapsedTranslate;
    }
    this.cdr.detectChanges();
  }

  selectResult(pin: ExploreMarker) {
    this.selectedPin = pin;
    this.drawerExpanded = false;
    this.drawerTranslateY = this.collapsedTranslate;
    this.map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(this.map.getZoom(), 12), duration: 800 });
  }

  closePin() {
    this.selectedPin = null;
  }

  openRoute(pin: ExploreMarker) {
    if (this.userLat !== null && this.userLng !== null) {
      this.navigateToRoute(pin);
    } else {
      this.pendingRoutePin = pin;
      this.showLocationModal = true;
      this.cdr.detectChanges();
    }
  }

  private navigateToRoute(pin: ExploreMarker) {
    const origin = `${this.userLat},${this.userLng}`;
    const destination = `${pin.lat},${pin.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  }

  async retryLocationForRoute() {
    this.showLocationModal = false;
    this.cdr.detectChanges();
    await this.requestGeolocation();
    if (this.userLat !== null && this.pendingRoutePin !== null) {
      this.navigateToRoute(this.pendingRoutePin);
    }
    this.pendingRoutePin = null;
    this.cdr.detectChanges();
  }

  dismissLocationModal() {
    this.showLocationModal = false;
    this.pendingRoutePin = null;
    this.cdr.detectChanges();
  }

  getStars(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map(i => i <= Math.round(rating));
  }

  ngOnDestroy() {
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');
    this.markers.forEach(m => m.remove());
    if (this.map) this.map.remove();
    if (this.themeObserver) this.themeObserver.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
