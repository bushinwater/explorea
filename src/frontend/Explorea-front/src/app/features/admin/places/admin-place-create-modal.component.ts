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
import { AdminPlacesService } from './admin-places.service';
import { AdminProfileService } from '../core/services/admin-profile.service';
import {
  CityOption,
  CountryOption,
  DestinationOption,
  InterestTagOption,
  PlaceDetail,
  PlaceImage,
  PlaceTypeOption,
  RegionOption,
} from './admin-places.models';
import { FilterDefinition } from '../../../core/services/lookup.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';

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
  selector: 'app-place-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './admin-place-create-modal.component.html',
  styleUrl: './admin-place-edit-modal.component.css',
})
export class PlaceCreateModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() types: PlaceTypeOption[] = [];
  @Input() regions: RegionOption[] = [];
  @Input() countries: CountryOption[] = [];
  @Input() isSuperAdmin = false;
  @Input() requiresOwnerDocuments = false;
  @Input() lockedRegionId: number | null = null;
  @Output() cancel  = new EventEmitter<void>();
  @Output() created = new EventEmitter<PlaceDetail>();

  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  protected readonly form = new FormGroup({
    name:        new FormControl('', [Validators.required, Validators.maxLength(200)]),
    slug:        new FormControl('', [Validators.required, Validators.maxLength(200)]),
    typeId:      new FormControl<string | null>(null, [Validators.required]),
    description: new FormControl('', [Validators.required, Validators.maxLength(MAX_DESC)]),
    address:     new FormControl(''),
    regionId:    new FormControl<string | null>(null, [Validators.required]),
    cityId:      new FormControl<string | null>(null),
    priceRange:  new FormControl(''),
    phone:       new FormControl('', [Validators.required, Validators.pattern(/^\+?[\d\s\(\)\-\.]{7,20}$/)]),
    email:       new FormControl('', [Validators.required, Validators.email]),
    websiteUrl:  new FormControl(''),
    latitude:    new FormControl<number | null>(null),
    longitude:   new FormControl<number | null>(null),
  });

  protected readonly MAX_DESC   = MAX_DESC;
  protected readonly MAX_IMAGES = MAX_IMAGES;

  // Core state
  protected readonly isClosing      = signal(false);
  protected readonly saveAttempted  = signal(false);
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
  protected readonly newFilterKey    = signal('');
  protected readonly newFilterLabel  = signal('');
  protected readonly newFilterType   = signal('boolean');
  protected readonly isAddingFilter  = signal(false);

  // New: interest tags
  protected readonly allInterestTags    = signal<InterestTagOption[]>([]);
  protected readonly selectedInterestIds = signal<number[]>([]);

  protected readonly pendingImages     = signal<{ file: File; url: string }[]>([]);
  protected readonly pendingHeroIndex  = signal<number>(0);
  protected readonly ownerDocuments = signal<Record<string, File | null>>({
    identity: null,
    authorization: null,
    license: null,
  });

  protected readonly allTypeOptions = computed(() => [...this.types, ...this.extraTypes()]);

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private createdId: string | null = null;
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
    private readonly profileSvc: AdminProfileService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedRegionId'] && this.lockedRegionId !== null) {
      this.applyRegionLock();
    }
  }

  ngOnInit(): void {
    this.applyRegionLock();
    if (this.lockedRegionId === null) this.loadCities();
    this.loadInterestTags();
    setTimeout(() => this.initMap(), 50);

    const profile = this.profileSvc.profile();
    if (profile?.email) {
      this.form.patchValue({ email: profile.email });
    }

    this.form.get('name')!.valueChanges.subscribe((name) => {
      if (name && !this.createdId) {
        this.form.patchValue({ slug: this.toSlug(name) }, { emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.sub.unsubscribe();
    this.themeObserver?.disconnect();
    this.map?.remove();
    this.pendingImages().forEach(p => URL.revokeObjectURL(p.url));
  }

  private applyRegionLock(): void {
    if (this.lockedRegionId === null) return;
    const region = this.regions.find(r => r.id === this.lockedRegionId);
    this.form.patchValue({ regionId: String(this.lockedRegionId) });
    if (region?.countryId != null) this.selectedCountryId.set(region.countryId);
    this.form.controls.regionId.disable();
    this.loadCities(this.lockedRegionId);
    this.cdr.detectChanges();
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
    const key   = this.newFilterKey().trim();
    const label = this.newFilterLabel().trim();
    const typeId = this.form.value.typeId ? +this.form.value.typeId : null;
    if (!key || !label || !typeId || this.isAddingFilter()) return;
    this.isAddingFilter.set(true);
    this.sub.add(
      this.svc.createFilterDefinition(typeId, key, label, this.newFilterType()).subscribe({
        next: fd => {
          this.modalFilterDefs.update(defs => [...defs, fd]);
          this.showAddFilter.set(false);
          this.newFilterKey.set('');
          this.newFilterLabel.set('');
          this.isAddingFilter.set(false);
          this.cdr.detectChanges();
        },
        error: () => { this.isAddingFilter.set(false); this.cdr.detectChanges(); },
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
        { headers: { 'Accept-Language': 'sr,en' } },
      ).subscribe({
        next: results => {
          this.isGeocoding.set(false);
          if (!results.length) { this.error.set('Adresa nije pronađena.'); this.cdr.detectChanges(); return; }
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

  // ── Images ──────────────────────────────────────────────────────────────
  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawFiles = Array.from(input.files ?? []);
    input.value = '';
    const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (files.length < rawFiles.length) { this.error.set('Slike moraju biti manje od 5 MB.'); }
    if (!files.length) { this.cdr.detectChanges(); return; }

    if (!this.createdId) {
      const slots = MAX_IMAGES - this.pendingImages().length;
      if (slots <= 0) { this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`); this.cdr.detectChanges(); return; }
      const toAdd = files.slice(0, slots).map(file => ({ file, url: URL.createObjectURL(file) }));
      this.pendingImages.update(p => [...p, ...toAdd]);
      this.cdr.detectChanges();
      return;
    }

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) { this.error.set(`Maksimalan broj slika je ${MAX_IMAGES}.`); this.cdr.detectChanges(); return; }
    const toUpload = files.slice(0, slots);
    this.uploadingCount.update(n => n + toUpload.length);
    toUpload.forEach(file => this.uploadFile(this.createdId!, file));
  }

  protected removePendingImage(index: number): void {
    const pending = this.pendingImages();
    URL.revokeObjectURL(pending[index].url);
    this.pendingImages.update(p => p.filter((_, i) => i !== index));
    const hero = this.pendingHeroIndex();
    if (hero === index) this.pendingHeroIndex.set(0);
    else if (hero > index) this.pendingHeroIndex.update(h => h - 1);
    this.cdr.detectChanges();
  }

  protected setPendingHero(index: number): void {
    this.pendingHeroIndex.set(index);
  }

  protected removeImage(imageId: string): void {
    if (!this.createdId) return;
    this.sub.add(
      this.svc.deleteImage(this.createdId, imageId).subscribe({
        next: () => {
          this.images.update(l => l.filter(i => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            this.heroImageId.set(null);
            const remaining = this.images();
            if (remaining.length > 0) this.setHero(remaining[0].id);
          }
          this.cdr.detectChanges();
        },
        error: () => { this.error.set('Greška pri brisanju slike.'); this.cdr.detectChanges(); },
      }),
    );
  }

  protected setHero(imageId: string): void {
    if (!this.createdId) return;
    this.sub.add(
      this.svc.setHeroImage(this.createdId, imageId).subscribe({
        next: () => { this.heroImageId.set(imageId); this.cdr.detectChanges(); },
      }),
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────
  protected save(): void {
    this.saveAttempted.set(true);
    this.form.markAllAsTouched();
    this.cdr.detectChanges();
    if (this.form.invalid) return;
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
    if (this.requiresOwnerDocuments && !this.hasRequiredOwnerDocuments()) {
      this.error.set('Dodaj licni dokument i dokaz vlasnistva ili ovlascenja.');
      return;
    }
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.error.set('');

    const v  = this.form.value;
    const ef = this.modalExtraFilters();
    this.sub.add(
      this.svc.create({
        name:         v.name!,
        slug:         v.slug!,
        typeId:       v.typeId ? +v.typeId : undefined,
        description:  v.description || undefined,
        address:      v.address || undefined,
        cityId:       v.cityId ? +v.cityId : undefined,
        destinationId: this.selectedDestinationId() ?? undefined,
        latitude:     v.latitude ?? undefined,
        longitude:    v.longitude ?? undefined,
        priceRange:   v.priceRange || undefined,
        phone:        v.phone || undefined,
        email:        v.email || undefined,
        websiteUrl:   v.websiteUrl || undefined,
        extraFilters: Object.keys(ef).length ? ef : undefined,
      }).subscribe({
        next: detail => {
          this.createdId = detail.id;
          this.form.disable();
          this.uploadPendingAndFinish(detail);
        },
        error: () => {
          this.isSaving.set(false);
          this.error.set('Greška pri kreiranju objekta.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected onOwnerDocumentSelected(type: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('Dokument mora biti manji od 10 MB.');
      this.cdr.detectChanges();
      return;
    }
    this.ownerDocuments.update(current => ({ ...current, [type]: file }));
    this.cdr.detectChanges();
  }

  protected removeOwnerDocument(type: string): void {
    this.ownerDocuments.update(current => ({ ...current, [type]: null }));
  }

  protected ownerDocumentName(type: string): string {
    return this.ownerDocuments()[type]?.name ?? '';
  }

  // ── Private helpers ─────────────────────────────────────────────────────
  private uploadPendingAndFinish(detail: PlaceDetail): void {
    const pending     = this.pendingImages();
    const heroIdx     = this.pendingHeroIndex();
    const interestIds = this.selectedInterestIds();
    const documents = this.ownerDocumentEntries();
    const total = pending.length + documents.length + (interestIds.length > 0 ? 1 : 0);

    if (total === 0) {
      this.isSaving.set(false);
      this.created.emit(detail);
      return;
    }

    let done = 0;
    const onDone = () => {
      done++;
      if (done === total) { this.isSaving.set(false); this.created.emit(detail); }
    };

    pending.forEach(({ file, url }, i) => {
      URL.revokeObjectURL(url);
      this.sub.add(
        this.svc.uploadImage(detail.id, file).subscribe({
          next: img => {
            if (i === heroIdx) this.svc.setHeroImage(detail.id, img.id).subscribe();
            onDone();
          },
          error: onDone,
        }),
      );
    });
    documents.forEach(([type, file]) => {
      this.sub.add(
        this.svc.uploadDocument(detail.id, type, file).subscribe({ next: onDone, error: onDone }),
      );
    });
    if (interestIds.length > 0) {
      this.sub.add(
        this.svc.setPlaceInterests(detail.id, interestIds).subscribe({ next: onDone, error: onDone }),
      );
    }
  }

  private hasRequiredOwnerDocuments(): boolean {
    const documents = this.ownerDocuments();
    return !!documents['identity'] && !!documents['authorization'];
  }

  private ownerDocumentEntries(): Array<[string, File]> {
    if (!this.requiresOwnerDocuments) return [];

    return Object.entries(this.ownerDocuments())
      .filter((entry): entry is [string, File] => entry[1] instanceof File);
  }

  private uploadFile(placeId: string, file: File): void {
    this.sub.add(
      this.svc.uploadImage(placeId, file).subscribe({
        next: img => {
          this.images.update(l => [...l, img]);
          this.uploadingCount.update(n => n - 1);
          if (this.heroImageId() === null) this.setHero(img.id);
          this.cdr.detectChanges();
        },
        error: err => {
          this.uploadingCount.update(n => n - 1);
          this.error.set(err?.error?.message ?? 'Greška pri otpremanju slike.');
          this.cdr.detectChanges();
        },
      }),
    );
  }

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

  private loadFilterDefs(typeId: number): void {
    this.sub.add(
      this.svc.getFilterDefinitions(typeId).subscribe({
        next: defs => { this.modalFilterDefs.set(defs); this.cdr.detectChanges(); },
        error: () => { this.modalFilterDefs.set([]); this.cdr.detectChanges(); },
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
    this.map.on('click', e => { this.setCoords(e.lngLat.lat, e.lngLat.lng); this.cdr.detectChanges(); });

    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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

  private toSlug(name: string): string {
    const map: Record<string, string> = {
      'š': 's', 'đ': 'dj', 'ć': 'c', 'č': 'c', 'ž': 'z',
      'Š': 's', 'Đ': 'dj', 'Ć': 'c', 'Č': 'c', 'Ž': 'z',
    };
    return name.split('').map(c => map[c] ?? c).join('')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
