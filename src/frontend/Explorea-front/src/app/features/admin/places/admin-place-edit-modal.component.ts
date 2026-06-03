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
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { AdminPlacesService } from './admin-places.service';
import {
  CityOption,
  CountryOption,
  DestinationOption,
  InterestTagOption,
  PlaceDetail,
  PlaceImage,
  PlaceRow,
  PlaceTypeOption,
  RegionOption,
} from './admin-places.models';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';
import { isPointInGeoJsonGeometry, parseRegionBoundary } from '../core/utils/geo-boundary.utils';

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
  selector: 'app-place-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './admin-place-edit-modal.component.html',
  styleUrl: './admin-place-edit-modal.component.css',
})
export class PlaceEditModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() row!: PlaceRow;
  @Input() types: PlaceTypeOption[] = [];
  @Input() regions: RegionOption[] = [];
  @Input() countries: CountryOption[] = [];
  @Input() isSuperAdmin = false;
  @Input() lockedRegionId: number | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<PlaceDetail>();

  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  protected readonly form = new FormGroup({
    name:           new FormControl('', [Validators.required, Validators.maxLength(200)]),
    slug:           new FormControl('', [Validators.required, Validators.maxLength(200)]),
    typeId:         new FormControl<string | null>(null, [Validators.required]),
    description:    new FormControl('', [Validators.required, Validators.maxLength(MAX_DESC)]),
    address:        new FormControl(''),
    regionId:       new FormControl<string | null>(null, [Validators.required]),
    cityId:         new FormControl<string | null>(null),
    priceRange:     new FormControl(''),
    phone:          new FormControl('', [Validators.required, Validators.pattern(/^\+?[\d\s\(\)\-\.]{7,20}$/)]),
    email:          new FormControl('', [Validators.required, Validators.email]),
    websiteUrl:     new FormControl(''),
    approvalStatus: new FormControl('approved'),
    isFeatured:     new FormControl(false),
    latitude:       new FormControl<number | null>(null),
    longitude:      new FormControl<number | null>(null),
  });

  protected readonly MAX_DESC   = MAX_DESC;
  protected readonly MAX_IMAGES = MAX_IMAGES;

  // Core state
  protected readonly isClosing      = signal(false);
  protected readonly saveAttempted  = signal(false);
  protected readonly isLoading      = signal(true);
  protected readonly isSaving       = signal(false);
  protected readonly isGeocoding    = signal(false);
  protected readonly error          = signal('');
  protected readonly images         = signal<PlaceImage[]>([]);
  protected readonly uploadingCount = signal(0);
  protected readonly heroImageId    = signal<string | null>(null);
  protected readonly cities         = signal<CityOption[]>([]);

  // New: location cascade
  protected readonly selectedCountryId = signal<number | null>(null);

  // New: destination search
  protected readonly destinationQuery        = signal('');
  protected readonly destinationResults      = signal<DestinationOption[]>([]);
  protected readonly isSearchingDestination  = signal(false);
  protected readonly showDestinationDropdown = signal(false);
  protected readonly selectedDestinationId   = signal<string | null>(null);

  // New: type row + filter defs
  protected readonly extraTypes     = signal<PlaceTypeOption[]>([]);
  protected readonly showAddType    = signal(false);
  protected readonly newTypeName    = signal('');
  protected readonly isAddingType   = signal(false);
  protected readonly modalFilterDefs    = signal<FilterDefinition[]>([]);
  protected readonly modalExtraFilters  = signal<Record<string, string>>({});
  protected readonly showAddFilter   = signal(false);
  protected readonly newFilterLabel  = signal('');
  protected readonly isAddingFilter  = signal(false);
  protected readonly deletingFilterId = signal<number | null>(null);
  protected readonly filterContextMenu = signal<{ id: number; key: string; x: number; y: number } | null>(null);

  // New: interest tags
  protected readonly allInterestTags     = signal<InterestTagOption[]>([]);
  protected readonly selectedInterestIds = signal<number[]>([]);
  protected readonly isLoadingInterests  = signal(false);

  protected readonly allTypeOptions = computed(() => [...this.types, ...this.extraTypes()]);

  protected readonly statusOptions = [
    { value: 'approved', label: 'Aktivno' },
    { value: 'pending',  label: 'Na čekanju' },
    { value: 'rejected', label: 'Odbijeno' },
    { value: 'inactive', label: 'Neaktivno' },
  ];

  protected readonly locationOutsideRegion = signal(false);

  private regionBoundary: any = null;
  private originalHeroImageId: string | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
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
    private readonly lookupService: LookupService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedRegionId'] && this.lockedRegionId !== null) {
      this.form.controls.regionId.disable();
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    if (this.lockedRegionId !== null) {
      this.svc.getRegionsGeo().subscribe(data => {
        const region = data.regions.find(r => r.id === this.lockedRegionId);
        if (region?.boundaryGeoJson) this.regionBoundary = parseRegionBoundary(region.boundaryGeoJson);
      });
    }
    this.loadInterestTags();
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
            email:          detail.email ?? '',
            websiteUrl:     detail.websiteUrl ?? '',
            approvalStatus: detail.status,
            isFeatured:     detail.isFeatured,
            latitude:       detail.latitude,
            longitude:      detail.longitude,
          });

          // Country
          if (detail.countryId != null) {
            this.selectedCountryId.set(detail.countryId);
          }

          // Destination
          if (detail.destinationId) {
            this.selectedDestinationId.set(detail.destinationId);
            if (detail.destination) this.destinationQuery.set(detail.destination);
          }

          // Extra filters
          if (detail.extraFilters) {
            this.modalExtraFilters.set({ ...detail.extraFilters });
          }

          this.images.set(detail.images);
          const hero = detail.images.find(i => i.sortOrder === 0);
          if (hero) {
            this.heroImageId.set(hero.id);
            this.originalHeroImageId = hero.id;
          }

          if (detail.region) {
            const region = this.regions.find(r => r.name === detail.region);
            if (region) {
              this.form.patchValue({ regionId: String(region.id) });
              this.loadCities(region.id, detail.cityId ?? undefined);
              if (this.selectedCountryId() == null && region.countryId != null) {
                this.selectedCountryId.set(region.countryId);
              }
            } else {
              this.loadCities(undefined, detail.cityId ?? undefined);
            }
          } else {
            this.loadCities(undefined, detail.cityId ?? undefined);
          }

          if (detail.typeId != null) {
            this.loadFilterDefs(detail.typeId);
          }

          if (this.lockedRegionId !== null) {
            this.form.controls.regionId.disable();
          }

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

    this.loadPlaceInterests();
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.sub.unsubscribe();
    this.themeObserver?.disconnect();
    this.map?.remove();
  }

  protected requestClose(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    setTimeout(() => this.cancel.emit(), 220);
  }

  protected get descLength(): number {
    return this.form.value.description?.length ?? 0;
  }

  protected get filteredRegions(): RegionOption[] {
    const cid = this.selectedCountryId();
    return cid === null ? this.regions : this.regions.filter(r => r.countryId === cid);
  }

  // ── Region / country cascade ───────────────────────────────────────────
  protected onRegionChange(): void {
    this.form.patchValue({ cityId: null });
    const regionId = this.form.value.regionId;
    if (regionId) {
      this.loadCities(+regionId);
      const region = this.regions.find(r => r.id === +regionId);
      if (region?.countryId != null && this.selectedCountryId() == null) {
        this.selectedCountryId.set(region.countryId);
      }
    } else {
      this.loadCities();
    }
    this.cdr.detectChanges();
  }

  protected onCountryChange(value: string): void {
    const cid = value ? +value : null;
    this.selectedCountryId.set(cid);
    const regionId = this.form.value.regionId;
    if (regionId) {
      const region = this.regions.find(r => r.id === +regionId);
      if (region && region.countryId !== cid) {
        this.form.patchValue({ regionId: null, cityId: null });
        this.cities.set([]);
      }
    }
    this.cdr.detectChanges();
  }

  // ── Destination search ─────────────────────────────────────────────────
  protected onDestinationInput(query: string): void {
    this.destinationQuery.set(query);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    if (!query.trim()) {
      this.destinationResults.set([]);
      this.showDestinationDropdown.set(false);
      return;
    }
    this.searchDebounce = setTimeout(() => {
      this.isSearchingDestination.set(true);
      const regionId = this.form.getRawValue().regionId ? +this.form.getRawValue().regionId! : undefined;
      this.sub.add(
        this.svc.searchDestinations(query.trim(), regionId).subscribe({
          next: results => {
            this.destinationResults.set(results);
            this.showDestinationDropdown.set(results.length > 0);
            this.isSearchingDestination.set(false);
            this.cdr.detectChanges();
          },
          error: () => { this.isSearchingDestination.set(false); this.cdr.detectChanges(); },
        }),
      );
    }, 300);
  }

  protected selectDestination(dest: DestinationOption): void {
    this.selectedDestinationId.set(dest.id);
    this.destinationQuery.set(dest.name);
    this.showDestinationDropdown.set(false);
    this.destinationResults.set([]);

    if (dest.regionId != null) {
      this.form.patchValue({ regionId: String(dest.regionId) });
      this.loadCities(dest.regionId, dest.cityId ?? undefined, dest.cityId == null ? (dest.city ?? dest.name) : undefined);
    }
    if (dest.countryId != null) {
      this.selectedCountryId.set(dest.countryId);
    } else if (dest.regionId != null) {
      const region = this.regions.find(r => r.id === dest.regionId);
      if (region?.countryId != null) this.selectedCountryId.set(region.countryId);
    }
    if (dest.latitude != null && dest.longitude != null) {
      this.setCoords(dest.latitude, dest.longitude);
    } else {
      this.sub.add(
        this.svc.getDestinationById(dest.id).subscribe({
          next: full => {
            if (full.latitude != null && full.longitude != null) {
              this.setCoords(full.latitude, full.longitude);
            }
            this.cdr.detectChanges();
          },
        }),
      );
    }
    this.cdr.detectChanges();
  }

  protected clearDestination(): void {
    this.selectedDestinationId.set(null);
    this.destinationQuery.set('');
    this.destinationResults.set([]);
    this.showDestinationDropdown.set(false);
    this.cdr.detectChanges();
  }

  // ── Type row ────────────────────────────────────────────────────────────
  protected onTypeChange(value: string): void {
    this.modalExtraFilters.set({});
    this.modalFilterDefs.set([]);
    if (value) this.loadFilterDefs(+value);
    this.cdr.detectChanges();
  }

  protected toggleAddType(): void {
    this.showAddType.update(v => !v);
    this.newTypeName.set('');
  }

  protected addNewType(): void {
    const name = this.newTypeName().trim();
    if (!name || this.isAddingType()) return;
    this.isAddingType.set(true);
    this.sub.add(
      this.svc.createType(name).subscribe({
        next: t => {
          this.extraTypes.update(ts => [...ts, t]);
          this.form.patchValue({ typeId: String(t.id) });
          this.onTypeChange(String(t.id));
          this.showAddType.set(false);
          this.isAddingType.set(false);
          this.cdr.detectChanges();
        },
        error: () => { this.isAddingType.set(false); this.cdr.detectChanges(); },
      }),
    );
  }

  // ── Filter defs ─────────────────────────────────────────────────────────
  protected updateModalExtraFilter(key: string, value: string | boolean): void {
    this.modalExtraFilters.update(ef => {
      const copy = { ...ef };
      if (value === false || value === '') delete copy[key];
      else copy[key] = String(value);
      return copy;
    });
  }

  protected isMultiFilterActive(key: string, value: string): boolean {
    const stored = this.modalExtraFilters()[key] ?? '';
    return stored.split(',').map(v => v.trim()).includes(value);
  }

  protected toggleMultiFilter(key: string, value: string): void {
    this.modalExtraFilters.update(ef => {
      const copy = { ...ef };
      const current = (copy[key] ?? '').split(',').map(v => v.trim()).filter(Boolean);
      const idx = current.indexOf(value);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(value);
      if (current.length === 0) delete copy[key];
      else copy[key] = current.join(',');
      return copy;
    });
  }

  protected toggleAddFilter(): void { this.showAddFilter.update(v => !v); }

  protected addNewFilter(): void {
    const label  = this.newFilterLabel().trim();
    const typeId = this.form.value.typeId ? +this.form.value.typeId : null;
    if (!label || !typeId || this.isAddingFilter()) return;
    this.isAddingFilter.set(true);
    this.sub.add(
      this.svc.createFilterDefinition(typeId, label, 'boolean').subscribe({
        next: fd => {
          this.modalFilterDefs.update(defs => [...defs, fd]);
          this.showAddFilter.set(false);
          this.newFilterLabel.set('');
          this.isAddingFilter.set(false);
          this.cdr.detectChanges();
        },
        error: () => { this.isAddingFilter.set(false); this.cdr.detectChanges(); },
      }),
    );
  }

  protected clearFilterValue(key: string): void {
    this.modalExtraFilters.update(ef => {
      const copy = { ...ef };
      delete copy[key];
      return copy;
    });
  }

  protected openFilterContextMenu(event: MouseEvent, def: FilterDefinition): void {
    event.preventDefault();
    this.filterContextMenu.set({ id: def.id, key: def.filterKey, x: event.clientX, y: event.clientY });
    this.cdr.detectChanges();
  }

  protected closeFilterContextMenu(): void {
    this.filterContextMenu.set(null);
  }

  protected deleteFilterDef(id: number): void {
    if (this.deletingFilterId() !== null) return;
    const def = this.modalFilterDefs().find(d => d.id === id);
    if (!def) return;
    this.deletingFilterId.set(id);
    this.sub.add(
      this.lookupService.deleteFilterDefinition(id).subscribe({
        next: () => {
          this.modalFilterDefs.update(d => d.filter(x => x.id !== id));
          const ef = { ...this.modalExtraFilters() };
          delete ef[def.filterKey];
          this.modalExtraFilters.set(ef);
          this.deletingFilterId.set(null);
          this.cdr.detectChanges();
        },
        error: () => { this.deletingFilterId.set(null); this.cdr.detectChanges(); },
      }),
    );
  }

  // ── Interest tags ───────────────────────────────────────────────────────
  protected toggleInterest(id: number): void {
    this.selectedInterestIds.update(ids => {
      if (ids.includes(id)) return ids.filter(i => i !== id);
      if (ids.length >= 3) return ids;
      return [...ids, id];
    });
  }

  // ── Geocode ─────────────────────────────────────────────────────────────
  protected geocode(): void {
    const address = this.form.value.address?.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.error.set('');
    this.sub.add(
      this.http.get<any[]>(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'Accept-Language': 'sr-Latn,en' } },
      ).subscribe({
        next: results => {
          this.isGeocoding.set(false);
          if (!results.length) { this.error.set('Adresa nije pronađena. Pokušaj preciznije.'); this.cdr.detectChanges(); return; }
          this.setCoords(parseFloat(results[0].lat), parseFloat(results[0].lon));
          this.cdr.detectChanges();
        },
        error: () => { this.isGeocoding.set(false); this.error.set('Greška pri pretrazi adrese.'); this.cdr.detectChanges(); },
      }),
    );
  }

  // ── Images ──────────────────────────────────────────────────────────────
  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawFiles = Array.from(input.files ?? []);
    input.value = '';
    const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (files.length < rawFiles.length) { this.error.set('Slike moraju biti manje od 5 MB.'); }
    if (!files.length) { this.cdr.detectChanges(); return; }

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) { this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`); this.cdr.detectChanges(); return; }
    const toUpload = files.slice(0, slots);
    if (files.length > slots) this.error.set(`Možeš dodati još ${slots} slika. Ostatak je ignorisan.`);
    this.uploadingCount.update(n => n + toUpload.length);
    toUpload.forEach(file => {
      this.sub.add(
        this.svc.uploadImage(this.row.id, file).subscribe({
          next: img => {
            this.images.update(list => [...list, img]);
            this.uploadingCount.update(n => n - 1);
            this.cdr.detectChanges();
          },
          error: err => {
            this.uploadingCount.update(n => n - 1);
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
          this.images.update(list => list.filter(i => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            const remaining = this.images();
            this.heroImageId.set(remaining.length > 0 ? remaining[0].id : null);
          }
          this.cdr.detectChanges();
        },
        error: () => { this.error.set('Greška pri brisanju slike.'); this.cdr.detectChanges(); },
      }),
    );
  }

  protected setHero(imageId: string): void {
    this.heroImageId.set(imageId);
  }

  // ── Save ────────────────────────────────────────────────────────────────
  protected save(): void {
    this.saveAttempted.set(true);
    this.form.markAllAsTouched();
    this.cdr.detectChanges();
    if (this.form.invalid) return;
    if (this.locationOutsideRegion()) return;
    if (!this.selectedDestinationId()) {
      this.error.set('Destinacija je obavezna.');
      return;
    }
    if (this.allInterestTags().length > 0 && this.selectedInterestIds().length === 0) {
      this.error.set('Izaberi bar jedno interesovanje.');
      return;
    }
    if (this.isSuperAdmin && !this.selectedCountryId()) {
      this.error.set('Država je obavezna.');
      return;
    }
    if (!this.images().length) {
      this.error.set('Dodaj bar jednu sliku.');
      return;
    }
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.error.set('');

    const v  = this.form.value;
    const ef = this.modalExtraFilters();
    this.sub.add(
      this.svc.update(this.row.id, {
        name:           v.name ?? undefined,
        slug:           v.slug ?? undefined,
        typeId:         v.typeId ? +v.typeId : undefined,
        description:    v.description ?? undefined,
        address:        v.address ?? undefined,
        cityId:         v.cityId ? +v.cityId : undefined,
        destinationId:  this.selectedDestinationId() ?? undefined,
        priceRange:     v.priceRange ?? undefined,
        phone:          v.phone ?? undefined,
        email:          v.email ?? undefined,
        websiteUrl:     v.websiteUrl ?? undefined,
        approvalStatus: v.approvalStatus ?? undefined,
        isFeatured:     v.isFeatured ?? undefined,
        latitude:       v.latitude ?? undefined,
        longitude:      v.longitude ?? undefined,
        extraFilters:   ef,
      }).subscribe({
        next: updated => {
          const pendingHero = this.heroImageId();
          const saveInterests = () => {
            this.sub.add(
              this.svc.setPlaceInterests(this.row.id, this.selectedInterestIds()).subscribe({
                next:  () => { this.isSaving.set(false); this.saved.emit(updated); },
                error: () => { this.isSaving.set(false); this.saved.emit(updated); },
              }),
            );
          };
          if (pendingHero && pendingHero !== this.originalHeroImageId) {
            this.svc.setHeroImage(this.row.id, pendingHero).subscribe({
              next:  () => saveInterests(),
              error: () => saveInterests(),
            });
          } else {
            saveInterests();
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

  // ── Private helpers ─────────────────────────────────────────────────────
  private loadCities(regionId?: number, selectCityId?: number, selectCityName?: string): void {
    let params = '';
    if (regionId !== undefined) params = `?regionId=${regionId}`;
    this.sub.add(
      this.http.get<CityOption[]>(`/api/cities${params}`).subscribe({
        next: cities => {
          this.cities.set(cities);
          if (selectCityId !== undefined) {
            const match = cities.find(c => c.id === selectCityId);
            if (match) { this.form.patchValue({ cityId: match.id.toString() }); }
            else if (selectCityName) {
              const byName = cities.find(c => c.name.toLowerCase() === selectCityName.toLowerCase());
              if (byName) this.form.patchValue({ cityId: byName.id.toString() });
            }
          } else if (selectCityName) {
            const byName = cities.find(c => c.name.toLowerCase() === selectCityName.toLowerCase());
            if (byName) this.form.patchValue({ cityId: byName.id.toString() });
          }
          this.cdr.detectChanges();
        },
      }),
    );
  }

  private loadInterestTags(): void {
    this.sub.add(
      this.svc.getAllInterestTags().subscribe({
        next: tags => { this.allInterestTags.set(tags); this.cdr.detectChanges(); },
      }),
    );
  }

  private loadPlaceInterests(): void {
    this.isLoadingInterests.set(true);
    this.sub.add(
      this.svc.getPlaceInterests(this.row.id).subscribe({
        next: tags => {
          this.selectedInterestIds.set(tags.filter(t => t.isAssigned).map(t => t.id));
          this.isLoadingInterests.set(false);
          this.cdr.detectChanges();
        },
        error: () => { this.isLoadingInterests.set(false); },
      }),
    );
  }

  private loadFilterDefs(typeId: number): void {
    this.sub.add(
      this.svc.getFilterDefinitions(typeId).subscribe({
        next: defs => { this.modalFilterDefs.set(defs); this.cdr.detectChanges(); },
        error: () => { this.modalFilterDefs.set([]); this.cdr.detectChanges(); },
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
      center, zoom, attributionControl: false,
    });
    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    if (lat != null && lng != null) {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat]).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.setCoords(pos.lat, pos.lng, true);
        this.cdr.detectChanges();
      });
    }

    this.map.on('click', e => { this.setCoords(e.lngLat.lat, e.lngLat.lng, true); this.cdr.detectChanges(); });

    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private setCoords(lat: number, lng: number, reverseGeocode = false): void {
    this.form.patchValue({ latitude: lat, longitude: lng });
    if (this.regionBoundary) {
      this.locationOutsideRegion.set(!isPointInGeoJsonGeometry(lat, lng, this.regionBoundary));
      this.cdr.detectChanges();
    }
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat]).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.setCoords(pos.lat, pos.lng, true);
        this.cdr.detectChanges();
      });
    }
    this.map.flyTo({ center: [lng, lat], zoom: 13, duration: 800 });
    if (reverseGeocode) {
      this.http.get<any>(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'sr-Latn,en' } },
      ).subscribe({
        next: result => {
          if (result?.address) {
            const a = result.address;
            const street = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(' ');
            const city = a.city ?? a.town ?? a.village ?? a.municipality ?? '';
            const shortAddr = [street, city].filter(Boolean).join(', ') || result.display_name;
            this.form.patchValue({ address: shortAddr });
            this.cdr.detectChanges();
            if (city) {
              this.sub.add(
                this.svc.searchDestinations(city).subscribe({
                  next: results => {
                    if (!results.length) return;
                    const dest = results[0];
                    this.selectedDestinationId.set(dest.id);
                    this.destinationQuery.set(dest.name);
                    this.destinationResults.set([]);
                    this.showDestinationDropdown.set(false);
                    if (this.lockedRegionId === null) {
                      if (dest.regionId != null) {
                        this.form.patchValue({ regionId: String(dest.regionId) });
                        this.loadCities(dest.regionId, dest.cityId ?? undefined, dest.cityId == null ? (dest.city ?? dest.name) : undefined);
                      }
                      if (dest.countryId != null) this.selectedCountryId.set(dest.countryId);
                    }
                    this.cdr.detectChanges();
                  },
                }),
              );
            }
          }
        },
      });

      if (this.lockedRegionId === null) {
        this.sub.add(
          this.http.get<{ regionId: number | null; countryId: number | null }>(
            `/api/region-by-coords?lat=${lat}&lng=${lng}`,
          ).subscribe({
            next: res => {
              if (res.countryId) this.selectedCountryId.set(res.countryId);
              if (res.regionId) this.form.patchValue({ regionId: String(res.regionId) });
              this.cdr.detectChanges();
            },
          }),
        );
      }
    }
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
        case 'fill-extrusion': layer.paint['fill-extrusion-color'] = p.extrusion; layer.paint['fill-extrusion-opacity'] = 1; break;
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
