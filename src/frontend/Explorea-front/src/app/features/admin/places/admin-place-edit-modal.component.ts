import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { AdminPlacesService } from './admin-places.service';
import { CityOption, PlaceDetail, PlaceImage, PlaceRow, PlaceTypeOption, RegionOption } from './admin-places.models';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';
const MAX_IMAGES = 10;
const MAX_DESC = 2000;

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

@Component({
  selector: 'app-place-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './admin-place-edit-modal.component.html',
  styleUrl: './admin-place-edit-modal.component.css',
})
export class PlaceEditModalComponent implements OnInit, OnDestroy {
  @Input() row!: PlaceRow;
  @Input() types: PlaceTypeOption[] = [];
  @Input() regions: RegionOption[] = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<PlaceDetail>();

  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  protected readonly form = new FormGroup({
    name:           new FormControl('', [Validators.required, Validators.maxLength(200)]),
    slug:           new FormControl('', [Validators.required, Validators.maxLength(200)]),
    typeId:         new FormControl<string | null>(null),
    description:    new FormControl('', [Validators.maxLength(MAX_DESC)]),
    address:        new FormControl(''),
    regionId:       new FormControl<string | null>(null),
    cityId:         new FormControl<string | null>(null),
    priceRange:     new FormControl(''),
    phone:          new FormControl(''),
    websiteUrl:     new FormControl(''),
    approvalStatus: new FormControl('approved'),
    isFeatured:     new FormControl(false),
    latitude:       new FormControl<number | null>(null),
    longitude:      new FormControl<number | null>(null),
  });

  protected readonly MAX_DESC    = MAX_DESC;
  protected readonly MAX_IMAGES  = MAX_IMAGES;

  protected readonly isLoading      = signal(true);
  protected readonly isSaving       = signal(false);
  protected readonly isGeocoding    = signal(false);
  protected readonly error          = signal('');
  protected readonly images         = signal<PlaceImage[]>([]);
  protected readonly uploadingCount = signal(0);
  protected readonly heroImageId    = signal<string | null>(null);
  protected readonly cities         = signal<CityOption[]>([]);

  protected readonly statusOptions = [
    { value: 'approved', label: 'Aktivno' },
    { value: 'pending',  label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  private originalHeroImageId: string | null = null;
  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private sub = new Subscription();

  constructor(
    private readonly svc: AdminPlacesService,
    private readonly http: HttpClient,
    protected readonly ui: AdminUiPreferencesService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.svc.getById(this.row.id).subscribe({
        next: (detail) => {
          this.form.patchValue({
            name:           detail.name,
            slug:           detail.slug,
            typeId:         detail.typeId?.toString() ?? null,
            description:    detail.description ?? '',
            address:        detail.address ?? '',
            priceRange:     detail.priceRange ?? '',
            phone:          detail.phone ?? '',
            websiteUrl:     detail.websiteUrl ?? '',
            approvalStatus: detail.status,
            isFeatured:     detail.isFeatured,
            latitude:       detail.latitude,
            longitude:      detail.longitude,
          });

          this.images.set(detail.images);
          const hero = detail.images.find((i) => i.sortOrder === 0);
          if (hero) {
            this.heroImageId.set(hero.id);
            this.originalHeroImageId = hero.id;
          }

          this.loadCities(undefined, detail.cityId ?? undefined);
          this.isLoading.set(false);
          this.cdr.detectChanges();
          setTimeout(() => this.initMap(detail.latitude, detail.longitude), 50);
        },
        error: () => {
          this.error.set('Greška pri učitavanju objekta.');
          this.isLoading.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.themeObserver?.disconnect();
    this.map?.remove();
  }

  protected get descLength(): number {
    return this.form.value.description?.length ?? 0;
  }

  protected onRegionChange(): void {
    this.form.patchValue({ cityId: null });
    const regionId = this.form.value.regionId;
    this.loadCities(regionId ? +regionId : undefined);
  }

  protected geocode(): void {
    const address = this.form.value.address?.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.error.set('');

    this.sub.add(
      this.http
        .get<any[]>(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          { headers: { 'Accept-Language': 'sr,en' } },
        )
        .subscribe({
          next: (results) => {
            this.isGeocoding.set(false);
            if (!results.length) {
              this.error.set('Adresa nije pronađena. Pokušaj preciznije.');
              this.cdr.detectChanges();
              return;
            }
            this.setCoords(parseFloat(results[0].lat), parseFloat(results[0].lon));
            this.cdr.detectChanges();
          },
          error: () => {
            this.isGeocoding.set(false);
            this.error.set('Greška pri pretrazi adrese.');
            this.cdr.detectChanges();
          },
        }),
    );
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) {
      this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`);
      this.cdr.detectChanges();
      return;
    }

    const toUpload = files.slice(0, slots);
    if (files.length > slots) {
      this.error.set(`Možeš dodati još ${slots} slika. Ostatak je ignorisan.`);
    }

    this.uploadingCount.update((n) => n + toUpload.length);

    toUpload.forEach((file) => {
      this.sub.add(
        this.svc.uploadImage(this.row.id, file).subscribe({
          next: (img) => {
            this.images.update((list) => [...list, img]);
            this.uploadingCount.update((n) => n - 1);
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.uploadingCount.update((n) => n - 1);
            this.error.set(err?.error?.message ?? 'Greška pri otpremanju slike.');
            this.cdr.detectChanges();
          },
        }),
      );
    });
  }

  protected removeImage(imageId: string): void {
    this.sub.add(
      this.svc.deleteImage(this.row.id, imageId).subscribe({
        next: () => {
          this.images.update((list) => list.filter((i) => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            const remaining = this.images();
            this.heroImageId.set(remaining.length > 0 ? remaining[0].id : null);
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.error.set('Greška pri brisanju slike.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected setHero(imageId: string): void {
    this.heroImageId.set(imageId);
  }

  protected save(): void {
    if (this.form.invalid || this.isSaving()) return;
    this.isSaving.set(true);
    this.error.set('');

    const v = this.form.value;
    this.sub.add(
      this.svc.update(this.row.id, {
        name:           v.name ?? undefined,
        slug:           v.slug ?? undefined,
        typeId:         v.typeId ? +v.typeId : undefined,
        description:    v.description ?? undefined,
        address:        v.address ?? undefined,
        cityId:         v.cityId ? +v.cityId : undefined,
        priceRange:     v.priceRange ?? undefined,
        phone:          v.phone ?? undefined,
        websiteUrl:     v.websiteUrl ?? undefined,
        approvalStatus: v.approvalStatus ?? undefined,
        isFeatured:     v.isFeatured ?? undefined,
        latitude:       v.latitude ?? undefined,
        longitude:      v.longitude ?? undefined,
      }).subscribe({
        next: (updated) => {
          const pendingHero = this.heroImageId();
          if (pendingHero && pendingHero !== this.originalHeroImageId) {
            this.svc.setHeroImage(this.row.id, pendingHero).subscribe({
              next:  () => { this.isSaving.set(false); this.saved.emit(updated); },
              error: () => { this.isSaving.set(false); this.saved.emit(updated); },
            });
          } else {
            this.isSaving.set(false);
            this.saved.emit(updated);
          }
        },
        error: () => {
          this.isSaving.set(false);
          this.error.set('Greška pri čuvanju izmena.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  private loadCities(regionId?: number, selectCityId?: number): void {
    let params = '';
    if (regionId !== undefined) params = `?regionId=${regionId}`;
    this.sub.add(
      this.http.get<CityOption[]>(`/api/cities${params}`).subscribe({
        next: (cities) => {
          this.cities.set(cities);
          if (selectCityId !== undefined) {
            const match = cities.find((c) => c.id === selectCityId);
            if (match) {
              this.form.patchValue({ cityId: match.id.toString() });
            }
          }
          this.cdr.detectChanges();
        },
      }),
    );
  }

  private async initMap(lat: number | null, lng: number | null): Promise<void> {
    if (!this.mapEl?.nativeElement) return;

    const base = patchStyleSources(await (await fetch(MAP_STYLE_URL)).json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    const center: [number, number] = lng != null && lat != null ? [lng, lat] : [20.457, 44.017];
    const zoom = lng != null ? 12 : 6;

    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center,
      zoom,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    if (lat != null && lng != null) {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);

      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.form.patchValue({ latitude: pos.lat, longitude: pos.lng });
        this.cdr.detectChanges();
      });
    }

    this.map.on('click', (e) => {
      this.setCoords(e.lngLat.lat, e.lngLat.lng);
      this.cdr.detectChanges();
    });

    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private setCoords(lat: number, lng: number): void {
    this.form.patchValue({ latitude: lat, longitude: lng });
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);

      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.form.patchValue({ latitude: pos.lat, longitude: pos.lng });
        this.cdr.detectChanges();
      });
    }

    this.map.flyTo({ center: [lng, lat], zoom: 13, duration: 800 });
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1, 3), 16) * 0.299
      + parseInt(hex.slice(3, 5), 16) * 0.587
      + parseInt(hex.slice(5, 7), 16) * 0.114;
  }

  private buildThemedStyle(base: any, p: typeof DARK): any {
    const themed = JSON.parse(JSON.stringify(base));
    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (layer.type) {
        case 'background':
          layer.paint['background-color'] = p.land; break;
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
          layer.paint['fill-color'] = c; break;
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
          layer.paint['line-color'] = c; break;
        }
        case 'fill-extrusion':
          layer.paint['fill-extrusion-color'] = p.extrusion;
          layer.paint['fill-extrusion-opacity'] = 1; break;
        case 'symbol':
          layer.paint['text-color'] = p.text;
          if (layer.paint['text-halo-color']) layer.paint['text-halo-color'] = p.text_halo;
          if (layer.paint['icon-color']) layer.paint['icon-color'] = p.icon; break;
      }
      return layer;
    });
    return themed;
  }
}
