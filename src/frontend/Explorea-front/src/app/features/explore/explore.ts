import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { Sidebar } from '../../layout/shell/sidebar/sidebar';

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

export interface MapPin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: string;
  rating: number;
  reviewCount: number;
  reviewQuote: string;
  location: string;
  distance: string;
  imageUrl: string;
  popular: boolean;
  price: string;
  tags: string[];
  isOpen?: boolean;
}

const MOCK_PINS: MapPin[] = [
  {
    id: 1,
    name: 'Planina Tara – Vidikovac',
    lat: 43.9,
    lng: 19.42,
    category: 'Priroda i Avantura',
    rating: 4.9,
    reviewCount: 340,
    reviewQuote: 'Neverovatna pogled na kanjon Drine koji je ostavlja dah. Obavezno poseti pri zalasku sunca.',
    location: 'Nacionalni Park Tara, Srbija',
    distance: '2.4 km od vas',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    popular: true,
    price: 'Besplatno',
    tags: ['Priroda', 'Preporučeno'],
    isOpen: true,
  },
  {
    id: 2,
    name: 'Vrelo Krupajsko',
    lat: 44.12,
    lng: 21.85,
    category: 'Priroda i Avantura',
    rating: 4.7,
    reviewCount: 215,
    reviewQuote: 'Kristalno plava voda i bujni zeleni okoliš. Savršeno mesto za odmor.',
    location: 'Boko Banja, Srbija',
    distance: '12 km od vas',
    imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
    popular: false,
    price: 'Besplatno',
    tags: ['Priroda', 'Voda'],
    isOpen: true,
  },
  {
    id: 3,
    name: 'Restoran Kalemegdan',
    lat: 44.82,
    lng: 20.45,
    category: 'Restorani i Hrana',
    rating: 4.5,
    reviewCount: 128,
    reviewQuote: 'Odlična srpska kuhinja uz pogled na tvrđavu. Preporučujem riblje specijalitete.',
    location: 'Kalemegdan, Beograd',
    distance: '0.8 km od vas',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    popular: false,
    price: '1200 RSD',
    tags: ['Hrana', 'Pogled'],
    isOpen: true,
  },
  {
    id: 4,
    name: 'Manastir Studenica',
    lat: 43.48,
    lng: 20.53,
    category: 'Kultura i Istorija',
    rating: 4.8,
    reviewCount: 422,
    reviewQuote: 'Jedan od najlepših srpskih manastira. UNESCO svetska baština koja ostavlja bez daha.',
    location: 'Ušće, Srbija',
    distance: '18 km od vas',
    imageUrl: 'https://images.unsplash.com/photo-1548407260-da850faa41e3?w=600&q=80',
    popular: true,
    price: 'Besplatno',
    tags: ['Kultura', 'Istorija', 'UNESCO'],
    isOpen: true,
  },
  {
    id: 5,
    name: 'Letnji Džez Festival',
    lat: 44.8,
    lng: 20.47,
    category: 'Lokalni Događaji',
    rating: 4.6,
    reviewCount: 89,
    reviewQuote: 'Prelepa muzika pod zvezdama. Atmosfera je magična svakog leta.',
    location: 'Botanička bašta, Beograd',
    distance: '1.2 km od vas',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80',
    popular: true,
    price: '500 RSD',
    tags: ['Muzika', 'Događaj'],
    isOpen: false,
  },
];

const CATEGORIES = [
  { key: 'sve', label: 'Sve', count: null },
  { key: 'Priroda i Avantura', label: 'Priroda i Avantura', count: 12 },
  { key: 'Restorani i Hrana', label: 'Restorani i Hrana', count: 9 },
  { key: 'Kultura i Istorija', label: 'Kultura i Istorija', count: 6 },
  { key: 'Lokalni Događaji', label: 'Lokalni Događaji', count: 4 },
];

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Sidebar],
  templateUrl: './explore.html',
  styleUrl: './explore.css',
})
export class Explore implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  map!: MapLibreMap;
  markers: Marker[] = [];
  private themeObserver!: MutationObserver;
  private lightStyle: any = null;
  private darkStyle: any = null;

  // State
  selectedPin: MapPin | null = null;
  drawerExpanded = false;
  filterCount = 0;

  // Filters
  radiusKm = 25;
  selectedCategory = 'sve';
  openNowOnly = false;
  minRating: number | null = null;
  categories = CATEGORIES;

  pins = MOCK_PINS;

  get sliderStyle(): { [key: string]: string } {
    const pct = ((this.radiusKm - 5) / 95) * 100;
    return {
      background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
    };
  }

  get filteredPins(): MapPin[] {
    return this.pins.filter(p => {
      if (this.selectedCategory !== 'sve' && p.category !== this.selectedCategory) return false;
      if (this.openNowOnly && !p.isOpen) return false;
      if (this.minRating !== null && p.rating < this.minRating) return false;
      return true;
    });
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.selectedCategory !== 'sve') count++;
    if (this.openNowOnly) count++;
    if (this.minRating !== null) count++;
    if (this.radiusKm !== 25) count++;
    return count;
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  ngAfterViewInit() {
    this.initMap();
    this.watchTheme();
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

  // Returns perceived luminance 0–255 for a hex color string
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

      // Remove fill-patterns — they render as hatched white and break any dark theme
      delete layer.paint['fill-pattern'];

      switch (type) {
        case 'background':
          layer.paint['background-color'] = p.land;
          break;

        case 'fill': {
          // Hide 2D building fills — 3D extrusion layer handles the visuals
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
            // Heuristic: if the original color was light (luminance > 128),
            // treat it as a surface area (road, plaza, etc.) rather than raw land
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
          // Theme any existing 3D building layers already in the base style
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

    this.map.on('click', e => {
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest('.map-pin-btn')) {
        this.selectedPin = null;
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

  private addMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers = [];

    this.filteredPins.forEach(pin => {
      const el = document.createElement('div');
      el.className = 'map-pin-btn';
      el.innerHTML = `
        <div class="pin-bubble${pin.popular ? ' pin-bubble--popular' : ''}">
          <span class="material-icons">location_on</span>
        </div>
        <div class="pin-label">${pin.name}</div>
      `;
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.selectedPin = pin;
        this.map.flyTo({ center: [pin.lng, pin.lat], zoom: 10, duration: 800 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(this.map);

      this.markers.push(marker);
    });
  }

  applyFilters() {
    this.addMarkers();
  }

  resetFilters() {
    this.radiusKm = 25;
    this.selectedCategory = 'sve';
    this.openNowOnly = false;
    this.minRating = null;
    this.addMarkers();
  }

  selectCategory(key: string) {
    this.selectedCategory = key;
  }

  setMinRating(val: number | null) {
    this.minRating = this.minRating === val ? null : val;
  }

  toggleDrawer() {
    this.drawerExpanded = !this.drawerExpanded;
  }

  selectResult(pin: MapPin) {
    this.selectedPin = pin;
    this.drawerExpanded = false;
    this.map.flyTo({ center: [pin.lng, pin.lat], zoom: 12, duration: 800 });
  }

  closePin() {
    this.selectedPin = null;
  }

  getStars(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map(i => i <= Math.round(rating));
  }

  getSlugFromName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  ngOnDestroy() {
    this.markers.forEach(m => m.remove());
    if (this.map) this.map.remove();
    if (this.themeObserver) this.themeObserver.disconnect();
  }
}
