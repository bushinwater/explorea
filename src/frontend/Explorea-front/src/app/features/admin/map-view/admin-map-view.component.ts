import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  HostBinding,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { ExploreService, ExploreMarker } from '../../../core/services/explore.service';
import { LookupService, LookupItem, FilterDefinition } from '../../../core/services/lookup.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { LayoutService } from '../core/services/layout.service';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';

interface RegionGeoItem {
  id: number;
  name: string;
  boundaryGeoJson: string;
}

interface RegionGeoResponse {
  regions: RegionGeoItem[];
  serbiaOutline: string | null;
}

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
  place:       '/admin/places',
};

const ADMIN_DELETE_ENDPOINTS: Record<string, string> = {
  destination: '/api/admin/destinations',
  activity:    '/api/admin/activities',
  event:       '/api/admin/events',
  place:       '/api/admin/places',
};

const REGION_COLORS: Record<number, string> = {
  1: '#e67e22',
  2: '#3498db',
  3: '#e74c3c',
  4: '#9b59b6',
  5: '#27ae60',
};

@Component({
  selector: 'app-admin-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './admin-map-view.component.html',
  styleUrl: './admin-map-view.component.css',
})
export class AdminMapViewComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class.sidebar-expanded')
  get sidebarExpanded() { return this.layout.sidebarExpanded(); }

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private map!: MapLibreMap;
  private markers: Marker[] = [];
  private readonly pinElements = new Map<string, HTMLElement>();
  private themeObserver?: MutationObserver;
  private lightStyle: any;
  private darkStyle: any;
  private currentMapTheme: 'dark' | 'light' = 'dark';

  pins: ExploreMarker[] = [];
  loading = false;
  currentZoom = 6.5;
  isSatellite = false;
  showRegions = true;
  filterPanelVisible = false;
  selectedPin: ExploreMarker | null = null;
  pinToDelete: ExploreMarker | null = null;
  isDeleting = false;

  private regionData: RegionGeoResponse | null = null;
  regionLegend: { id: number; name: string; color: string }[] = [];

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
    private http: HttpClient,
    private router: Router,
    public auth: DashboardAuthService,
    public ui: AdminUiPreferencesService,
    public layout: LayoutService,
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
    if (role === 'super_admin') return this.ui.t('map.region.all');
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
      if (this.showRegions && this.regionData) this.applyRegionLayers();
    });
    this.cdr.detectChanges();
  }

  onPinClick(pin: ExploreMarker): void {
    if (this.selectedPin) {
      this.pinElements.get(this.pinKey(this.selectedPin))?.classList.remove('map-pin-btn--selected');
    }
    this.selectedPin = pin;
    this.pinElements.get(this.pinKey(pin))?.classList.add('map-pin-btn--selected');
    this.cdr.detectChanges();
  }

  closePinCard(): void {
    if (this.selectedPin) {
      this.pinElements.get(this.pinKey(this.selectedPin))?.classList.remove('map-pin-btn--selected');
    }
    this.selectedPin = null;
    this.cdr.detectChanges();
  }

  private pinKey(pin: ExploreMarker): string {
    return `${pin.entityType}:${pin.id}`;
  }

  openInTouristApp(pin: ExploreMarker): void {
    window.open(this.getUserRoute(pin), '_blank', 'noopener');
  }

  editPin(pin: ExploreMarker): void {
    const route = ADMIN_ROUTES[pin.entityType] ?? '/admin/destinations';
    this.router.navigate([route], { state: { openEditId: pin.id } });
  }

  deletePin(pin: ExploreMarker): void {
    this.pinToDelete = pin;
    this.cdr.detectChanges();
  }

  cancelDeletePin(): void {
    this.pinToDelete = null;
    this.isDeleting = false;
    this.cdr.detectChanges();
  }

  confirmDeletePin(): void {
    const pin = this.pinToDelete;
    const endpoint = pin ? ADMIN_DELETE_ENDPOINTS[pin.entityType] : null;
    if (!pin || !endpoint) return;

    this.isDeleting = true;
    this.cdr.detectChanges();

    this.http.delete<void>(`${endpoint}/${pin.id}`).subscribe({
      next: () => {
        this.pins = this.pins.filter(p => !(p.entityType === pin.entityType && p.id === pin.id));
        this.selectedPin = null;
        this.pinToDelete = null;
        this.isDeleting = false;
        this.addMarkers();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isDeleting = false;
        this.cdr.detectChanges();
      },
    });
  }

  get deletePinTitle(): string {
    return this.pinToDelete ? `Obriši ${this.getPinTypeLabel(this.pinToDelete.entityType).toLowerCase()}` : '';
  }

  get deletePinDescription(): string {
    return this.pinToDelete
      ? `Da li sigurno želite da obrišete "${this.pinToDelete.name}"? Ova akcija se ne može poništiti.`
      : '';
  }

  getPinTypeLabel(type: string): string {
    const key = 'dashboard.entity.' + type;
    const translated = this.ui.t(key);
    return translated !== key ? translated : (ENTITY_TYPES.find(et => et.type === type)?.label ?? type);
  }

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  getPinSubtitle(pin: ExploreMarker): string {
    if (pin.subtitle) return pin.subtitle;
    if (pin.startDatetime) return new Date(pin.startDatetime).toLocaleDateString(this.dateLocale);
    if (pin.price !== null) return `${pin.price.toLocaleString(this.dateLocale)} RSD`;
    return this.getPinTypeLabel(pin.entityType);
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

    this.currentMapTheme = this.isDark ? 'dark' : 'light';
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
      this.loadRegionBoundaries();
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

    if (this.auth.role() === 'tourist_organization') {
      const rid = this.auth.managedRegionId;
      if (rid !== null) params.regionId = rid;
    }

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

  getPinColor(entityType: string): string {
    return ENTITY_TYPES.find(et => et.type === entityType)?.color ?? 'var(--color-primary)';
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

  private addMarkers(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.pinElements.clear();

    this.filteredPins.forEach(pin => {
      const icon  = this.getPinIcon(pin.entityType);
      const color = this.getPinColor(pin.entityType);
      const isSelected = this.selectedPin?.entityType === pin.entityType && this.selectedPin?.id === pin.id;

      const el = document.createElement('div');
      el.className = 'map-pin-btn' + (isSelected ? ' map-pin-btn--selected' : '');
      el.style.setProperty('--pin-color', color);
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

      this.pinElements.set(this.pinKey(pin), el);

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
      const wantTheme = this.isDark ? 'dark' : 'light';
      if (wantTheme === this.currentMapTheme) return;
      this.currentMapTheme = wantTheme;
      const style = wantTheme === 'dark' ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        this.add3DBuildings();
        this.addMarkers();
        if (this.showRegions && this.regionData) {
          this.applyRegionLayers();
          if (this.regionData.regions.length === 1) this.fitToRegion(this.regionData.regions[0]);
        }
      });
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ── Region overlays ───────────────────────────────────────

  toggleRegions(): void {
    this.showRegions = !this.showRegions;
    if (this.showRegions && this.regionData) {
      this.applyRegionLayers();
    } else if (!this.showRegions) {
      this.removeRegionLayers();
    }
    this.cdr.detectChanges();
  }

  private loadRegionBoundaries(): void {
    this.http.get<RegionGeoResponse>('/api/admin/destinations/regions-geo').subscribe({
      next: data => {
        this.regionData = data;
        this.regionLegend = data.regions.map(r => ({
          id: r.id, name: r.name, color: REGION_COLORS[r.id] ?? '#888',
        }));
        this.cdr.detectChanges();
        const apply = () => {
          if (this.showRegions) this.applyRegionLayers();
          if (data.regions.length === 1) this.fitToRegion(data.regions[0]);
        };
        if (this.map.getStyle()) {
          apply();
        } else {
          this.map.once('style.load', apply);
        }
      },
      error: () => {},
    });
  }

  private fitToRegion(region: RegionGeoItem): void {
    try {
      const geom = JSON.parse(region.boundaryGeoJson);
      const coords = this.extractCoords(geom);
      if (!coords.length) return;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const c of coords) {
        if (c[0] < minLng) minLng = c[0];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      }
      this.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800, maxZoom: 10 });
    } catch (e) {
      console.error('fitToRegion error', e);
    }
  }

  private extractCoords(geom: any): number[][] {
    if (!geom) return [];
    switch (geom.type) {
      case 'Point':       return [geom.coordinates];
      case 'LineString':
      case 'MultiPoint':  return geom.coordinates ?? [];
      case 'Polygon':
      case 'MultiLineString': return (geom.coordinates ?? []).flat(1);
      case 'MultiPolygon':    return (geom.coordinates ?? []).flat(2);
      case 'GeometryCollection':
        return (geom.geometries ?? []).flatMap((g: any) => this.extractCoords(g));
      default: return [];
    }
  }

  private applyRegionLayers(): void {
    if (!this.regionData || !this.map.getStyle()) return;
    const beforeId = this.firstSymbolLayerId();
    const isSingle = this.regionData.regions.length === 1;

    this.regionData.regions.forEach(region => {
      const color = REGION_COLORS[region.id] ?? '#888888';
      const srcId  = `region-source-${region.id}`;
      const fillId = `region-fill-${region.id}`;
      const lineId = `region-line-${region.id}`;

      if (!this.map.getSource(srcId)) {
        this.map.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: JSON.parse(region.boundaryGeoJson), properties: {} } as any,
        });
      }
      if (!this.map.getLayer(fillId)) {
        this.map.addLayer(
          { id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': color, 'fill-opacity': isSingle ? 0.35 : 0.1 } } as any,
        );
      }
      if (!this.map.getLayer(lineId)) {
        this.map.addLayer(
          { id: lineId, type: 'line', source: srcId, paint: { 'line-color': color, 'line-width': isSingle ? 3 : 1.5, 'line-opacity': 1 } } as any,
        );
      }
    });

    if (this.regionData.serbiaOutline) {
      const srcId  = 'serbia-outline-source';
      const lineId = 'serbia-outline-line';
      if (!this.map.getSource(srcId)) {
        this.map.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: JSON.parse(this.regionData.serbiaOutline), properties: {} } as any,
        });
      }
      if (!this.map.getLayer(lineId)) {
        this.map.addLayer(
          { id: lineId, type: 'line', source: srcId, paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.55, 'line-dasharray': [4, 2] } } as any,
          beforeId,
        );
      }
    }
  }

  private removeRegionLayers(): void {
    if (!this.map.isStyleLoaded()) return;
    [1, 2, 3, 4, 5].forEach(id => {
      if (this.map.getLayer(`region-fill-${id}`)) this.map.removeLayer(`region-fill-${id}`);
      if (this.map.getLayer(`region-line-${id}`)) this.map.removeLayer(`region-line-${id}`);
      if (this.map.getSource(`region-source-${id}`)) this.map.removeSource(`region-source-${id}`);
    });
    if (this.map.getLayer('serbia-outline-line')) this.map.removeLayer('serbia-outline-line');
    if (this.map.getSource('serbia-outline-source')) this.map.removeSource('serbia-outline-source');
  }

  private firstSymbolLayerId(): string | undefined {
    return (this.map.getStyle()?.layers ?? []).find(l => l.type === 'symbol')?.id;
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
