import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { AdminDestinationsService } from './admin-destinations.service';
import { CountryOption, DestinationImage, DestinationRow, InterestTagOption, RegionOption, TypeOption } from './admin-destinations.models';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';
import { isPointInGeoJsonGeometry, parseRegionBoundary } from '../core/utils/geo-boundary.utils';
import { applyRegionScopeOverlay, drawManagedRegion, drawManagedRegions, fitMapToBoundary, fitMapToRegions, RegionGeoItem } from '../core/utils/region-overlay.utils';
const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
  selector: 'app-destination-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './admin-destination-create-modal.component.html',
  styleUrl: './admin-destination-edit-modal.component.css',
})
export class DestinationCreateModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() types: TypeOption[] = [];
  @Input() lockedRegionId: number | null = null;
  @Output() cancel       = new EventEmitter<void>();
  @Output() created      = new EventEmitter<DestinationRow>();
  @Output() typeCreated  = new EventEmitter<TypeOption>();

  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  protected readonly form = new FormGroup({
    name:        new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl('', [Validators.required, Validators.maxLength(MAX_DESC)]),
    visibility:  new FormControl('published', [Validators.required]),
    typeId:      new FormControl<string | null>(null, [Validators.required]),
    countryId:   new FormControl<string | null>(null, [Validators.required]),
    regionId:    new FormControl<string | null>(null, [Validators.required]),
    address:     new FormControl('', [Validators.required]),
    latitude:    new FormControl<number | null>(null, [Validators.required]),
    longitude:   new FormControl<number | null>(null, [Validators.required]),
  });

  protected readonly MAX_DESC   = MAX_DESC;
  protected readonly MAX_IMAGES = MAX_IMAGES;

  protected readonly isSaving      = signal(false);
  protected readonly isGeocoding   = signal(false);
  protected readonly error         = signal('');
  protected readonly createdRow    = signal<DestinationRow | null>(null);
  protected readonly images        = signal<DestinationImage[]>([]);
  protected readonly uploadingCount = signal(0);
  protected readonly heroImageId      = signal<string | null>(null);
  protected readonly isSettingHero    = signal(false);
  protected readonly pendingImages     = signal<{ file: File; url: string }[]>([]);
  protected readonly pendingHeroIndex  = signal<number>(0);
  protected readonly localTypes       = signal<TypeOption[]>([]);
  protected readonly localRegions     = signal<RegionOption[]>([]);
  protected readonly localCountries   = signal<CountryOption[]>([]);
  protected readonly selectedCountryId = signal<number | null>(null);
  protected readonly filteredRegions  = computed(() => {
    const cid = this.selectedCountryId();
    if (cid === null) return this.localRegions();
    return this.localRegions().filter(r => r.countryId === cid);
  });
  protected readonly allInterestTags     = signal<InterestTagOption[]>([]);
  protected readonly selectedInterestIds = signal<number[]>([]);
  protected readonly saveAttempted       = signal(false);
  protected readonly showNewTypeInput = signal(false);
  protected readonly newTypeName      = signal('');
  protected readonly isCreatingType   = signal(false);
  protected readonly locationOutsideRegion = signal(false);

  private regionBoundary: any = null;
  private regionBoundaryRaw: string | null = null;
  private regionsRaw: RegionGeoItem[] | null = null;

  protected readonly filterDefs     = signal<FilterDefinition[]>([]);
  protected readonly showAddFilter  = signal(false);
  protected readonly newFilterLabel = signal('');
  protected readonly isAddingFilter = signal(false);
  protected readonly extraFilters   = signal<Record<string, string>>({});

  protected readonly visibilityOptions = [
    { value: 'published', label: 'Aktivno'     },
    { value: 'draft',     label: 'Na čekanju'  },
    { value: 'inactive',  label: 'Neaktivno'   },
    { value: 'rejected',  label: 'Odbijeno'    },
  ];

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private sub = new Subscription();

  constructor(
    private readonly svc: AdminDestinationsService,
    private readonly lookupService: LookupService,
    private readonly http: HttpClient,
    protected readonly ui: AdminUiPreferencesService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.localTypes.set([...this.types]);
    this.svc.getRegions().subscribe(r => {
      this.localRegions.set(r);
      this.applyRegionLock();
      this.cdr.detectChanges();
    });
    this.svc.getRegionsGeo().subscribe(data => {
      const result = applyRegionScopeOverlay(this.map, data, this.lockedRegionId);
      this.regionBoundaryRaw = result.boundaryRaw;
      this.regionsRaw = result.regions;
      this.regionBoundary = result.boundaryRaw ? parseRegionBoundary(result.boundaryRaw) : null;
    });
    this.svc.getCountries().subscribe(c => { this.localCountries.set(c); this.cdr.detectChanges(); });
    this.svc.getAllInterestTags().subscribe(tags => { this.allInterestTags.set(tags); this.cdr.detectChanges(); });
    this.form.controls.countryId.valueChanges.subscribe(val => {
      const id = val ? parseInt(val) : null;
      this.selectedCountryId.set(id);
      // reset region if it no longer belongs to the selected country
      const regionVal = this.form.value.regionId;
      if (regionVal) {
        const regionId = parseInt(regionVal);
        const stillValid = this.filteredRegions().some(r => r.id === regionId);
        if (!stillValid) this.form.patchValue({ regionId: null });
      }
      this.cdr.detectChanges();
    });
    this.form.controls.typeId.valueChanges.subscribe(val => {
      const typeId = val ? parseInt(val) : null;
      this.extraFilters.set({});
      if (typeId !== null) {
        this.loadFilterDefs(typeId);
      } else {
        this.filterDefs.set([]);
      }
      this.cdr.detectChanges();
    });
    setTimeout(() => this.initMap(), 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedRegionId'] && this.localRegions().length > 0) {
      this.applyRegionLock();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.themeObserver?.disconnect();
    this.map?.remove();
    this.pendingImages().forEach(p => URL.revokeObjectURL(p.url));
  }

  private applyRegionLock(): void {
    if (this.lockedRegionId === null) return;
    const region = this.localRegions().find(r => r.id === this.lockedRegionId);
    const countryId = region?.countryId ?? null;
    this.selectedCountryId.set(countryId);
    this.form.patchValue({
      regionId:  this.lockedRegionId.toString(),
      countryId: countryId ? countryId.toString() : null,
    });
    this.form.controls.regionId.disable();
    this.form.controls.countryId.disable();
    this.cdr.detectChanges();
  }

  protected toggleInterest(id: number): void {
    const current = this.selectedInterestIds();
    if (current.includes(id)) {
      this.selectedInterestIds.set(current.filter(i => i !== id));
    } else if (current.length < 3) {
      this.selectedInterestIds.set([...current, id]);
    }
  }

  protected get descLength(): number {
    return this.form.value.description?.length ?? 0;
  }

  protected get isCreated(): boolean {
    return this.createdRow() !== null;
  }

  protected geocode(): void {
    const address = this.form.value.address?.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.error.set('');

    this.http
      .get<any[]>(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'Accept-Language': 'sr-Latn,en' } },
      )
      .subscribe({
        next: (results) => {
          this.isGeocoding.set(false);
          if (!results.length) {
            this.error.set('Adresa nije pronađena.');
            this.cdr.detectChanges();
            return;
          }
          this.setCoords(parseFloat(results[0].lat), parseFloat(results[0].lon), true);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isGeocoding.set(false);
          this.error.set('Greška pri pretrazi adrese.');
          this.cdr.detectChanges();
        },
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();
    this.saveAttempted.set(true);
    if (this.form.invalid || this.isSaving() || this.pendingImages().length === 0 || this.locationOutsideRegion()) return;
    if (this.selectedInterestIds().length === 0) return;
    this.isSaving.set(true);
    this.error.set('');

    const v = this.form.getRawValue();
    this.sub.add(
      this.svc.createDestination({
        name:        v.name!,
        slug:        this.toSlug(v.name!),
        description: v.description!,
        address:     v.address || null,
        latitude:    v.latitude!,
        longitude:   v.longitude!,
        visibility:  v.visibility!,
        typeId:      v.typeId     ? parseInt(v.typeId)     : null,
        regionId:    v.regionId   ? parseInt(v.regionId)   : null,
        countryId:   v.countryId  ? parseInt(v.countryId)  : null,
        extraFilters: v.typeId ? this.extraFilters() : undefined,
      }).subscribe({
        next: (row) => {
          this.createdRow.set(row);
          const ids = this.selectedInterestIds();
          if (ids.length > 0) {
            this.svc.setDestinationInterests(row.id, ids).subscribe();
          }
          this.uploadPendingImages(row.id);
          this.isSaving.set(false);
          this.form.disable();
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSaving.set(false);
          this.error.set('Greška pri kreiranju destinacije.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected get canFinish(): boolean {
    return this.images().length >= 2;
  }

  protected finish(): void {
    if (!this.canFinish) return;
    this.created.emit(this.createdRow()!);
  }

  protected confirmNewType(): void {
    const name = this.newTypeName().trim();
    if (!name || this.isCreatingType()) return;
    this.isCreatingType.set(true);
    this.sub.add(
      this.svc.createType(name).subscribe({
        next: (type) => {
          const opt: TypeOption = { id: type.id, name: type.name };
          this.localTypes.update(l => [...l, opt]);
          this.typeCreated.emit(opt);
          this.form.patchValue({ typeId: type.id.toString() });
          this.showNewTypeInput.set(false);
          this.newTypeName.set('');
          this.isCreatingType.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isCreatingType.set(false);
          this.error.set('Greška pri kreiranju kategorije.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected updateExtraFilter(key: string, value: string | boolean): void {
    this.extraFilters.update(ef => {
      const n = { ...ef };
      if (value === false || value === '') delete n[key];
      else n[key] = String(value);
      return n;
    });
  }

  protected toggleAddFilter(): void {
    this.showAddFilter.update(v => !v);
    this.newFilterLabel.set('');
  }

  protected addNewFilter(): void {
    const typeId = this.form.value.typeId ? parseInt(this.form.value.typeId) : null;
    const label = this.newFilterLabel().trim();
    if (!typeId || !label || this.isAddingFilter()) return;
    this.isAddingFilter.set(true);
    this.sub.add(
      this.svc.createFilterDefinition(typeId, label, 'boolean').subscribe({
        next: def => {
          this.filterDefs.update(d => [...d, def]);
          this.isAddingFilter.set(false);
          this.showAddFilter.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isAddingFilter.set(false);
          this.error.set('Kreiranje filtera nije uspelo.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected setHero(imageId: string): void {
    const destId = this.createdRow()?.id;
    if (!destId || this.isSettingHero()) return;
    this.isSettingHero.set(true);
    this.sub.add(
      this.svc.setPreviewImage(destId, imageId).subscribe({
        next: () => {
          this.heroImageId.set(imageId);
          this.isSettingHero.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSettingHero.set(false);
          this.error.set('Greška pri postavljanju hero slike.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawFiles = Array.from(input.files ?? []);
    input.value = '';
    const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (files.length < rawFiles.length) { this.error.set('Slike moraju biti manje od 5 MB.'); }
    if (!files.length) { this.cdr.detectChanges(); return; }

    const destId = this.createdRow()?.id;
    if (!destId) {
      const pending = this.pendingImages();
      const slots = MAX_IMAGES - pending.length;
      if (slots <= 0) { this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`); this.cdr.detectChanges(); return; }
      const toAdd = files.slice(0, slots).map(file => ({ file, url: URL.createObjectURL(file) }));
      this.pendingImages.update(p => [...p, ...toAdd]);
      this.cdr.detectChanges();
      return;
    }

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) {
      this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`);
      this.cdr.detectChanges();
      return;
    }

    const toUpload = files.slice(0, slots);
    if (files.length > slots)
      this.error.set(`Možeš dodati još ${slots} slika. Ostatak je ignorisan.`);

    this.uploadingCount.update((n) => n + toUpload.length);

    toUpload.forEach((file) => {
      this.sub.add(
        this.svc.addImage(destId, file).subscribe({
          next: (img) => {
            this.images.update((l) => [...l, img]);
            this.uploadingCount.update((n) => n - 1);
            if (this.heroImageId() === null) {
              this.setHero(img.id);
            }
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

  protected removePendingImage(index: number): void {
    const pending = this.pendingImages();
    URL.revokeObjectURL(pending[index].url);
    this.pendingImages.update(p => p.filter((_, i) => i !== index));
    const hero = this.pendingHeroIndex();
    if (hero === index) this.pendingHeroIndex.set(0);
    else if (hero > index) this.pendingHeroIndex.update(h => h - 1);
  }

  protected setPendingHero(index: number): void {
    this.pendingHeroIndex.set(index);
  }

  private uploadPendingImages(destId: string): void {
    const pending = this.pendingImages();
    if (!pending.length) return;
    const heroIdx = this.pendingHeroIndex();
    this.pendingImages.set([]);
    this.pendingHeroIndex.set(0);
    this.uploadingCount.update(n => n + pending.length);
    pending.forEach(({ file, url }, i) => {
      URL.revokeObjectURL(url);
      this.sub.add(
        this.svc.addImage(destId, file).subscribe({
          next: (img) => {
            this.images.update(l => [...l, img]);
            this.uploadingCount.update(n => n - 1);
            if (i === heroIdx) this.setHero(img.id);
            else if (this.heroImageId() === null) this.setHero(img.id);
            if (this.uploadingCount() === 0 && this.canFinish) {
              this.created.emit(this.createdRow()!);
            }
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.uploadingCount.update(n => n - 1);
            this.error.set(err?.error?.message ?? 'Greška pri otpremanju slike.');
            this.cdr.detectChanges();
          },
        }),
      );
    });
  }

  protected removeImage(imageId: string): void {
    const destId = this.createdRow()?.id;
    if (!destId) return;
    this.sub.add(
      this.svc.deleteImage(destId, imageId).subscribe({
        next: () => {
          this.images.update((l) => l.filter((i) => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            this.heroImageId.set(null);
            const remaining = this.images();
            if (remaining.length > 0) this.setHero(remaining[0].id);
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

  private loadFilterDefs(typeId: number): void {
    this.sub.add(
      this.lookupService.getFilterDefinitions('destination', typeId).subscribe({
        next: defs => { this.filterDefs.set(defs); this.cdr.detectChanges(); },
        error: () => this.filterDefs.set([]),
      }),
    );
  }

  private async initMap(): Promise<void> {
    if (!this.mapEl?.nativeElement) return;

    const base = patchStyleSources(await (await fetch(MAP_STYLE_URL)).json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [20.9, 44.0],
      zoom: 6,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    this.map.on('click', (e) => {
      this.setCoords(e.lngLat.lat, e.lngLat.lng, true);
      this.cdr.detectChanges();
    });

    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });

    if (this.regionBoundaryRaw && this.map) {
      drawManagedRegion(this.map, this.regionBoundaryRaw);
      fitMapToBoundary(this.map, this.regionBoundaryRaw);
    } else if (this.regionsRaw && this.map) {
      drawManagedRegions(this.map, this.regionsRaw);
      fitMapToRegions(this.map, this.regionsRaw);
    }
  }

  private setCoords(lat: number, lng: number, reverseGeocode = false): void {
    this.form.patchValue({ latitude: lat, longitude: lng });
    if (this.regionBoundary) {
      this.locationOutsideRegion.set(!isPointInGeoJsonGeometry(lat, lng, this.regionBoundary));
    }

    if (!this.map) return;
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);

      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.setCoords(pos.lat, pos.lng, true);
        this.cdr.detectChanges();
      });
    }

    this.map.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });

    if (reverseGeocode) {
      this.http
        .get<any>(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { headers: { 'Accept-Language': 'sr-Latn,en' } },
        )
        .subscribe({
          next: (result) => {
            if (result?.address) {
              const a = result.address;
              const street = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(' ');
              const city = a.city ?? a.town ?? a.village ?? a.municipality ?? '';
              const shortAddr = [street, city].filter(Boolean).join(', ') || result.display_name;
              this.form.patchValue({ address: shortAddr });
              this.cdr.detectChanges();
            }
          },
        });

      if (!this.form.controls.regionId.disabled) {
        this.http
          .get<{ regionId: number | null; countryId: number | null }>(`/api/region-by-coords?lat=${lat}&lng=${lng}`)
          .subscribe({
            next: (res) => {
              if (res.countryId) this.form.patchValue({ countryId: res.countryId.toString() });
              if (res.regionId) this.form.patchValue({ regionId: res.regionId.toString() });
              this.cdr.detectChanges();
            },
          });
      }
    }
  }

  private toSlug(name: string): string {
    const map: Record<string, string> = {
      'š':'s','đ':'dj','ć':'c','č':'c','ž':'z',
      'Š':'s','Đ':'dj','Ć':'c','Č':'c','Ž':'z',
    };
    return name
      .split('').map(c => map[c] ?? c).join('')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1,3),16)*0.299 + parseInt(hex.slice(3,5),16)*0.587 + parseInt(hex.slice(5,7),16)*0.114;
  }

  private checkLocationBoundary(lat: number, lng: number): void {
    if (!this.regionBoundary) return;
    this.locationOutsideRegion.set(!isPointInGeoJsonGeometry(lat, lng, this.regionBoundary));
  }

  private buildThemedStyle(base: any, p: typeof DARK): any {
    const themed = JSON.parse(JSON.stringify(base));
    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (layer.type) {
        case 'background': layer.paint['background-color'] = p.land; break;
        case 'fill': {
          let c: string;
          if (/building/.test(id)) { layer.paint['fill-opacity'] = 0; break; }
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) { c = p.water; layer.paint['fill-outline-color'] = p.water; }
          else if (/forest|wood|scrub|grass|park|nature|garden|vegetation|landcover/.test(id)) { c = p.park; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park; }
          else if (/landuse/.test(id)) { c = p.park; }
          else if (/sand|beach|desert|bare/.test(id)) { c = p.sand; }
          else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) { c = p.pedestrian; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian; }
          else if (/bridge/.test(id)) { c = p.bridge; }
          else { const orig = typeof layer.paint['fill-color']==='string' ? layer.paint['fill-color'] : ''; c = this.luminance(orig)>128 ? p.surface : p.land; }
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
          else { const orig = typeof layer.paint['line-color']==='string' ? layer.paint['line-color'] : ''; c = this.luminance(orig)>128 ? p.road_minor : p.land; }
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


