import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { ExploreService, ExploreMarker } from '../../../core/services/explore.service';
import { LookupService, LookupItem, FilterDefinition } from '../../../core/services/lookup.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';

const DARK = {
  land: '#1e2e24', water: '#102840', park: '#1e3228',
  road_major: '#486858', road_minor: '#364e40', road_path: '#2c4436',
  building: '#253828', building_outline: '#30503c', extrusion: '#5a9e78',
  boundary: '#335244', text: '#c8d8cc', text_halo: '#182818',
  sand: '#262614', pedestrian: '#283e30', surface: '#243a2c',
  bridge: '#2e4c3a', icon: '#8aab96',
};

const LIGHT = {
  land: '#eef1ec', water: '#6bb0d4', park: '#96c89c',
  road_major: '#ffffff', road_minor: '#f5f8f4', road_path: '#deeadc',
  building: '#ccd8c8', building_outline: '#b0c4ac', extrusion: '#a2dcad',
  boundary: '#6b826b', text: '#1a3828', text_halo: '#eef1ec',
  sand: '#e0d8b0', pedestrian: '#dce8d8', surface: '#e4eee0',
  bridge: '#d8e4d4', icon: '#28694c',
};

const ENTITY_TYPES = [
  { type: 'destination', icon: 'landscape',     color: '#4caf7d', label: 'Destinacije' },
  { type: 'place',       icon: 'store',          color: '#2196f3', label: 'Objekti'     },
  { type: 'activity',    icon: 'directions_run', color: '#ff9800', label: 'Aktivnosti'  },
  { type: 'event',       icon: 'event',          color: '#e91e63', label: 'Događaji'    },
];

const ADMIN_ROUTES: Record<string, string> = {
  destination: '/admin/destinations',
  activity:    '/admin/activities',
  event:       '/admin/events',
  place:       '/admin/destinations',
};

@Component({
  selector: 'app-admin-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-map-view.component.html',
  styleUrl: './admin-map-view.component.css',
})
export class AdminMapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private map!: MapLibreMap;
  private markers: Marker[] = [];
  private themeObserver?: MutationObserver;
  private lightStyle: any;
  private darkStyle: any;

  pins: ExploreMarker[] = [];
  loading = false;
  currentZoom = 6.5;
  isSatellite = false;
  filterPanelVisible = false;

  // Filters
  selectedEntityTypes: string[] = [];   // backend types: 'destination'|'place'|'activity'|'event'
  openNowOnly = false;
  minRating: number | null = null;
  hoverRating: number | null = null;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  selectedSubcatIds: number[] = [];
  extraFilters: Record<string, string> = {};
  filterDefs: FilterDefinition[] = [];
  filterDefsLoading = false;
  private filterDefsTypeId: number | null = null;

  // Lookups
  placeTypes: LookupItem[] = [];
  activityCategories: LookupItem[] = [];
  eventTypes: LookupItem[] = [];
  destinationTypes: LookupItem[] = [];

  readonly entityTypes = ENTITY_TYPES;

  constructor(
    private cdr: ChangeDetectorRef,
    private exploreService: ExploreService,
    private lookupService: LookupService,
    private router: Router,
    public auth: DashboardAuthService,
    public ui: AdminUiPreferencesService,
  ) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.watchTheme();
    this.loadLookups();
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
    this.map?.remove();
  }

  // ── Computed ──────────────────────────────────────────────

  private get zoomVisibleTypes(): string[] {
    if (this.currentZoom < 8)  return ['destination'];
    if (this.currentZoom < 11) return ['destination', 'event', 'activity'];
    return ['destination', 'event', 'activity', 'place'];
  }

  get filteredPins(): ExploreMarker[] {
    if (this.selectedEntityTypes.length > 0) {
      return this.pins.filter(p => this.selectedEntityTypes.includes(p.entityType));
    }
    return this.pins.filter(p => this.zoomVisibleTypes.includes(p.entityType));
  }

  get pinCount(): number { return this.filteredPins.length; }

  get regionLabel(): string {
    const role = this.auth.role();
    if (role === 'super_admin') return 'Srbija: Sve regije';
    return `Regija: ${this.auth.userRegion}`;
  }

  get activeFilterCount(): number {
    let n = 0;
    if (this.selectedEntityTypes.length > 0) n++;
    if (this.openNowOnly) n++;
    if (this.minRating !== null) n++;
    if (this.selectedSubcatIds.length > 0) n++;
    if (this.minPrice !== null || this.maxPrice !== null) n++;
    if (Object.keys(this.extraFilters).length > 0) n++;
    return n;
  }

  get subcatEntityType(): string | null {
    return this.selectedEntityTypes.length === 1 ? this.selectedEntityTypes[0] : null;
  }

  get subcatsToShow(): LookupItem[] {
    switch (this.subcatEntityType) {
      case 'destination': return this.destinationTypes;
      case 'place':       return this.placeTypes;
      case 'activity':    return this.activityCategories;
      case 'event':       return this.eventTypes;
      default:            return [];
    }
  }

  get showExtraFilters(): boolean {
    return this.subcatEntityType === 'place' && this.selectedSubcatIds.length === 1;
  }

  get showPriceRange(): boolean {
    return this.selectedEntityTypes.some(t => t === 'place' || t === 'event');
  }

  // ── Filter methods ────────────────────────────────────────

  isEntityTypeSelected(type: string): boolean { return this.selectedEntityTypes.includes(type); }

  toggleEntityType(type: string): void {
    const idx = this.selectedEntityTypes.indexOf(type);
    if (idx >= 0) this.selectedEntityTypes.splice(idx, 1);
    else this.selectedEntityTypes.push(type);
    this.selectedSubcatIds = [];
    this.extraFilters = {};
    this.filterDefs = [];
    this.filterDefsTypeId = null;
    this.addMarkers();
    this.cdr.detectChanges();
  }

  isSubcatSelected(id: number): boolean { return this.selectedSubcatIds.includes(id); }

  toggleSubcat(id: number): void {
    const idx = this.selectedSubcatIds.indexOf(id);
    if (idx >= 0) this.selectedSubcatIds.splice(idx, 1);
    else this.selectedSubcatIds.push(id);
    this.extraFilters = {};
    this.filterDefs = [];
    this.filterDefsTypeId = null;
    if (this.subcatEntityType === 'place' && this.selectedSubcatIds.length === 1) {
      this.loadFilterDefs(this.selectedSubcatIds[0]);
    }
    this.fetchMarkers();
  }

  isExtraFilterActive(key: string, value = 'true'): boolean { return this.extraFilters[key] === value; }

  toggleExtraFilter(key: string, value = 'true'): void {
    const cur = { ...this.extraFilters };
    if (cur[key] === value) delete cur[key];
    else cur[key] = value;
    this.extraFilters = cur;
  }

  setMinRating(val: number): void { this.minRating = this.minRating === val ? null : val; }

  applyFilters(): void { this.fetchMarkers(); }

  resetFilters(): void {
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

  toggleSatellite(): void {
    this.isSatellite = !this.isSatellite;
    if (this.isSatellite) {
      this.map.setStyle({
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri World Imagery',
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
      } as any);
    } else {
      this.map.setStyle(this.isDark ? this.darkStyle : this.lightStyle);
    }
    this.map.once('style.load', () => {
      if (!this.isSatellite) this.add3DBuildings();
      this.addMarkers();
    });
    this.cdr.detectChanges();
  }

  onPinClick(pin: ExploreMarker): void {
    const role = this.auth.role();
    if (role === 'super_admin') {
      const route = ADMIN_ROUTES[pin.entityType] ?? '/admin/destinations';
      this.router.navigate([route], { queryParams: { selected: pin.slug } });
    } else {
      this.router.navigate([this.getUserRoute(pin)]);
    }
  }

  private getUserRoute(pin: ExploreMarker): string {
    switch (pin.entityType) {
      case 'destination': return `/destinations/${pin.slug}`;
      case 'place':       return `/places/${pin.slug}`;
      case 'activity':    return `/activities/${pin.slug}`;
      case 'event':       return `/events/${pin.slug}`;
      default:            return '/';
    }
  }

  // ── Init ──────────────────────────────────────────────────

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private async initMap(): Promise<void> {
    const base = patchStyleSources(await (await fetch(MAP_STYLE_URL)).json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [20.9, 44.0],
      zoom: 6.5,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    this.map.on('load', () => {
      this.add3DBuildings();
      this.fetchMarkers();
    });

    this.map.on('zoomend', () => {
      const newZoom = this.map.getZoom();
      const tier = (z: number) => z < 8 ? 0 : z < 11 ? 1 : 2;
      if (tier(newZoom) !== tier(this.currentZoom)) {
        this.currentZoom = newZoom;
        this.addMarkers();
        this.cdr.detectChanges();
      } else {
        this.currentZoom = newZoom;
      }
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

  private loadFilterDefs(typeId: number): void {
    if (this.filterDefsTypeId === typeId) return;
    this.filterDefsLoading = true;
    this.filterDefsTypeId  = typeId;
    this.cdr.detectChanges();
    this.lookupService.getFilterDefinitions('place', typeId).subscribe({
      next: defs => { this.filterDefs = defs; this.filterDefsLoading = false; this.cdr.detectChanges(); },
      error: ()   => { this.filterDefs = [];   this.filterDefsLoading = false; this.cdr.detectChanges(); },
    });
  }

  private fetchMarkers(): void {
    this.loading = true;
    this.cdr.detectChanges();

    const params: any = { radius: 1000, limit: 1000 };
    if (this.minRating !== null) params.minRating = this.minRating;
    if (this.openNowOnly) params.openNow = true;
    if (this.minPrice !== null) params.minPrice = this.minPrice;
    if (this.maxPrice !== null) params.maxPrice = this.maxPrice;
    if (Object.keys(this.extraFilters).length > 0) params.extraFilters = this.extraFilters;

    if (this.subcatEntityType === 'place'       && this.selectedSubcatIds.length > 0) params.placeTypeIds         = this.selectedSubcatIds;
    if (this.subcatEntityType === 'activity'     && this.selectedSubcatIds.length > 0) params.activityCategoryIds  = this.selectedSubcatIds;
    if (this.subcatEntityType === 'event'        && this.selectedSubcatIds.length > 0) params.eventTypeIds         = this.selectedSubcatIds;
    if (this.subcatEntityType === 'destination'  && this.selectedSubcatIds.length > 0) params.destinationTypeIds   = this.selectedSubcatIds;

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

  // ── Markers ───────────────────────────────────────────────

  private getPinColor(entityType: string): string {
    return ENTITY_TYPES.find(et => et.type === entityType)?.color ?? 'var(--color-primary)';
  }

  private getPinIcon(entityType: string): string {
    switch (entityType) {
      case 'destination': return 'landscape';
      case 'place':       return 'store';
      case 'activity':    return 'directions_run';
      case 'event':       return 'event';
      default:            return 'location_on';
    }
  }

  private addMarkers(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];

    this.filteredPins.forEach(pin => {
      const icon  = this.getPinIcon(pin.entityType);
      const color = this.getPinColor(pin.entityType);

      const el = document.createElement('div');
      el.className = 'map-pin-btn';
      el.innerHTML = `
        <div class="pin-bubble" style="background:${color};border-color:${color}">
          <span class="material-icons">${icon}</span>
        </div>
        <div class="pin-label">${pin.name}</div>
      `;
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(this.map.getZoom(), 12), duration: 800 });
        this.onPinClick(pin);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(this.map);

      this.markers.push(marker);
    });

    this.cdr.detectChanges();
  }

  // ── Map helpers ───────────────────────────────────────────

  private add3DBuildings(): void {
    const style = this.map.getStyle();
    if (!style?.layers || this.map.getLayer('3d-buildings')) return;
    const buildingLayer = style.layers.find(
      l => l.id.includes('building') && (l as any).type === 'fill',
    ) as any;
    if (!buildingLayer) return;
    const palette = this.isDark ? DARK : LIGHT;
    this.map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: this.isDark ? 0.25 : 0.4 });
    this.map.addLayer({
      id: '3d-buildings',
      type: 'fill-extrusion',
      source: buildingLayer.source,
      'source-layer': buildingLayer['source-layer'],
      minzoom: 14,
      paint: {
        'fill-extrusion-color': palette.extrusion,
        'fill-extrusion-height': ['max', ['coalesce', ['get', 'height'], ['*', ['coalesce', ['get', 'levels'], 2], 3.5]], 5],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 1,
      },
    } as any, buildingLayer.id);
  }

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map || this.isSatellite) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        this.add3DBuildings();
        this.addMarkers();
      });
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1, 3), 16) * 0.299 + parseInt(hex.slice(3, 5), 16) * 0.587 + parseInt(hex.slice(5, 7), 16) * 0.114;
  }

  private buildThemedStyle(base: any, p: typeof DARK & typeof LIGHT): any {
    const themed = JSON.parse(JSON.stringify(base));
    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (layer.type) {
        case 'background':
          layer.paint['background-color'] = p.land;
          break;
        case 'fill': {
          let c: string;
          if (/building/.test(id)) { layer.paint['fill-opacity'] = 0; break; }
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) { c = p.water; layer.paint['fill-outline-color'] = p.water; }
          else if (/forest|wood|scrub|grass|park|nature|garden|vegetation|landcover/.test(id)) { c = p.park; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park; }
          else if (/landuse/.test(id)) { c = p.park; }
          else if (/sand|beach|desert|bare/.test(id)) { c = p.sand; }
          else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) { c = p.pedestrian; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian; }
          else if (/bridge/.test(id)) { c = p.bridge; }
          else { const orig = typeof layer.paint['fill-color'] === 'string' ? layer.paint['fill-color'] : ''; c = this.luminance(orig) > 128 ? p.surface : p.land; }
          layer.paint['fill-color'] = c;
          break;
        }
        case 'line': {
          let c: string;
          if (/water|river|stream|canal/.test(id)) c = p.water;
          else if (/boundary|border/.test(id)) c = p.boundary;
          else if (/motorway|trunk|primary|major/.test(id)) c = p.road_major;
          else if (/path|track|footway|cycleway|step/.test(id)) c = p.road_path;
          else if (/bridge/.test(id)) c = p.bridge;
          else if (/casing|outline/.test(id)) c = p.land;
          else { const orig = typeof layer.paint['line-color'] === 'string' ? layer.paint['line-color'] : ''; c = this.luminance(orig) > 128 ? p.road_minor : p.land; }
          layer.paint['line-color'] = c;
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
}
