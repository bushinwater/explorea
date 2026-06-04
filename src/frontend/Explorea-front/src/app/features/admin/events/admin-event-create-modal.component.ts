import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import {
  CountryOption,
  RegionWithCountry,
  DestinationSearchItem,
  PlaceSearchItem,
  CreateEventPayload,
  EventFilterOption,
  EventImageItem,
  EventRow,
  InterestTagOption,
} from './admin-events.models';
import { AdminEventsService } from './admin-events.service';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';
import { isPointInGeoJsonGeometry, parseRegionBoundary } from '../core/utils/geo-boundary.utils';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

interface EventForm {
  name: string;
  description: string;
  typeId: number | null;
  startDatetime: string;
  endDatetime: string;
  price: string;
  address: string;
  destinationId: string | null;
  placeId: string | null;
  ticketUrl: string;
  isFeatured: boolean;
  recursAnnually: boolean;
  extraFilters: Record<string, string>;
}

@Component({
  selector: 'app-event-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './admin-event-create-modal.component.html',
  styleUrl: './admin-event-modal.component.css',
})
export class EventCreateModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() eventTypeOptions: EventFilterOption<number>[] = [];
  @Input() lockedRegionId: number | null = null;
  @Input() closing = false;
  @Input() requiresOwnerDocuments = false;
  @Input() isSuperAdmin = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() created = new EventEmitter<EventRow>();

  @ViewChild('mapEl', { static: false }) private mapEl?: ElementRef<HTMLDivElement>;

  protected readonly form = signal<EventForm>(this.emptyForm());
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly isGeocoding = signal(false);
  protected readonly mapLatitude = signal<number | null>(null);
  protected readonly mapLongitude = signal<number | null>(null);

  protected readonly createdRow = signal<EventRow | null>(null);
  protected readonly images = signal<EventImageItem[]>([]);
  protected readonly heroImageId = signal<string | null>(null);
  protected readonly uploadingCount = signal(0);
  protected readonly isSettingHero = signal(false);
  protected readonly pendingImages    = signal<{ file: File; url: string }[]>([]);
  protected readonly pendingHeroIndex = signal<number>(0);
  protected readonly ownerDocuments = signal<Record<string, File | null>>({
    identity: null,
    authorization: null,
    license: null,
  });

  protected readonly allInterestTags = signal<InterestTagOption[]>([]);
  protected readonly selectedInterestIds = signal<number[]>([]);

  // Location cascade
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly allRegions = signal<RegionWithCountry[]>([]);
  protected readonly selectedCountryId = signal<number | null>(null);
  protected readonly selectedRegionId = signal<number | null>(null);
  protected readonly filteredRegions = computed(() => {
    const cid = this.selectedCountryId();
    const all = this.allRegions();
    return cid === null ? all : all.filter(r => r.countryId === cid);
  });

  // Destination search
  protected readonly destinationQuery = signal('');
  protected readonly destinationResults = signal<DestinationSearchItem[]>([]);
  protected readonly showDestResults = signal(false);
  protected readonly isSearchingDest = signal(false);
  protected readonly selectedDestName = signal('');

  // Place search
  protected readonly placeQuery = signal('');
  protected readonly placeResults = signal<PlaceSearchItem[]>([]);
  protected readonly showPlaceResults = signal(false);
  protected readonly isSearchingPlaces = signal(false);
  protected readonly selectedPlaceName = signal('');
  protected readonly ownerPlaces = signal<PlaceSearchItem[]>([]);

  // Filter definitions
  protected readonly filterDefs = signal<FilterDefinition[]>([]);

  // Add new type
  protected readonly showAddType = signal(false);
  protected readonly newTypeName = signal('');
  protected readonly isAddingType = signal(false);
  protected readonly extraTypes = signal<EventFilterOption<number>[]>([]);
  protected readonly allTypeOptions = computed(() => [...this.eventTypeOptions, ...this.extraTypes()]);

  protected readonly deletingFilterId = signal<number | null>(null);
  protected readonly filterContextMenu = signal<{ id: number; key: string; x: number; y: number } | null>(null);

  // Add new filter definition
  protected readonly showAddFilter = signal(false);
  protected readonly newFilterLabel = signal('');
  protected readonly newFilterType = signal('boolean');
  protected readonly isAddingFilter = signal(false);

  protected readonly freeEntryKey = computed(() =>
    this.filterDefs().find(d =>
      d.filterKey === 'free_entry' ||
      d.filterLabel.toLowerCase().includes('besplat')
    )?.filterKey ?? null
  );

  protected readonly MAX_IMAGES = MAX_IMAGES;

  get nowDatetimeLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  protected readonly locationOutsideRegion = signal(false);
  protected readonly lockedCountryId = signal<number | null>(null);

  private regionBoundary: any = null;
  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private readonly sub = new Subscription();
  private readonly destSearch$ = new Subject<string>();
  private readonly placeSearch$ = new Subject<string>();

  constructor(
    private readonly eventsService: AdminEventsService,
    private readonly lookupService: LookupService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedRegionId'] && this.lockedRegionId !== null) {
      this.applyRegionLock();
    }
  }

  ngAfterViewInit(): void {
    this.sub.add(
      this.destSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(q => {
        if (!q.trim()) { this.destinationResults.set([]); this.showDestResults.set(false); this.isSearchingDest.set(false); this.cdr.detectChanges(); return; }
        this.isSearchingDest.set(true);
        this.eventsService.searchDestinations(q, this.selectedRegionId() ?? undefined).subscribe({
          next: r => { this.destinationResults.set(r); this.showDestResults.set(r.length > 0); this.isSearchingDest.set(false); this.cdr.detectChanges(); },
          error: () => { this.isSearchingDest.set(false); this.cdr.detectChanges(); },
        });
      }),
    );
    this.sub.add(
      this.placeSearch$.pipe(debounceTime(300)).subscribe(q => {
        if (!q.trim()) { this.placeResults.set([]); this.showPlaceResults.set(false); this.isSearchingPlaces.set(false); this.cdr.detectChanges(); return; }
        this.isSearchingPlaces.set(true);
        this.eventsService.searchPlaces(q, this.form().destinationId ?? undefined).subscribe({
          next: r => { this.placeResults.set(r); this.showPlaceResults.set(r.length > 0); this.isSearchingPlaces.set(false); this.cdr.detectChanges(); },
          error: () => { this.isSearchingPlaces.set(false); this.cdr.detectChanges(); },
        });
      }),
    );

    if (this.requiresOwnerDocuments) {
      this.sub.add(
        this.eventsService.getMyPlaces().subscribe({
          next: places => { this.ownerPlaces.set(places); this.cdr.detectChanges(); },
          error: () => {},
        }),
      );
    }

    setTimeout(() => this.initMap(), 50);

    this.sub.add(this.eventsService.getAllInterestTags().subscribe({
      next: t => { this.allInterestTags.set(t); this.cdr.detectChanges(); }, error: () => {},
    }));
    this.sub.add(this.eventsService.getCountries().subscribe({
      next: c => { this.countries.set(c); this.cdr.detectChanges(); }, error: () => {},
    }));
    this.sub.add(this.eventsService.getRegionsWithCountry().subscribe({
      next: r => {
        this.allRegions.set(r);
        this.applyRegionLock();
        this.cdr.detectChanges();
      },
      error: () => {},
    }));
    if (this.lockedRegionId !== null) {
      this.eventsService.getRegionsGeo().subscribe(data => {
        const region = data.regions.find(r => r.id === this.lockedRegionId);
        if (region?.boundaryGeoJson) this.regionBoundary = parseRegionBoundary(region.boundaryGeoJson);
      });
    }
  }

  private applyRegionLock(): void {
    if (this.lockedRegionId === null) return;
    const region = this.allRegions().find(r => r.id === this.lockedRegionId);
    if (region) {
      this.selectedRegionId.set(region.id);
      if (region.countryId != null) {
        this.selectedCountryId.set(region.countryId);
        this.lockedCountryId.set(region.countryId);
      }
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroyMap();
    this.pendingImages().forEach(p => URL.revokeObjectURL(p.url));
  }

  protected readonly isCreated = computed(() => this.createdRow() !== null);

  protected updateText(field: keyof Pick<EventForm, 'name' | 'description' | 'startDatetime' | 'endDatetime' | 'price' | 'address' | 'ticketUrl'>, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  protected updateType(value: string): void {
    const typeId = value ? Number(value) : null;
    this.form.update(f => ({ ...f, typeId, extraFilters: {} }));
    this.filterDefs.set([]);
    if (typeId !== null) this.loadFilterDefs(typeId);
  }

  protected updateExtraFilter(key: string, value: string | boolean): void {
    const fek = this.freeEntryKey();
    this.form.update(f => {
      const ef = { ...f.extraFilters };
      if (value === false || value === '') delete ef[key];
      else ef[key] = String(value);
      const price = fek && key === fek && ef[fek] === 'true' ? '' : f.price;
      return { ...f, extraFilters: ef, price };
    });
  }

  protected updateFeatured(checked: boolean): void {
    this.form.update(f => ({ ...f, isFeatured: checked }));
  }

  protected updateRecursAnnually(checked: boolean): void {
    this.form.update(f => ({ ...f, recursAnnually: checked }));
  }

  // Country → Region cascade
  protected updateCountry(value: string): void {
    this.selectedCountryId.set(value ? Number(value) : null);
    this.selectedRegionId.set(null);
    this.clearDestination();
  }

  protected updateRegion(value: string): void {
    this.selectedRegionId.set(value ? Number(value) : null);
    this.clearDestination();
  }

  // Destination typeahead
  protected onDestinationInput(query: string): void {
    this.destinationQuery.set(query);
    if (!query.trim()) { this.clearDestination(); return; }
    this.destSearch$.next(query);
  }

  protected selectDestination(item: DestinationSearchItem): void {
    this.form.update(f => ({ ...f, destinationId: item.id, placeId: null }));
    this.selectedDestName.set(item.name);
    this.destinationQuery.set(item.name);
    this.destinationResults.set([]);
    this.showDestResults.set(false);
    if (item.countryId != null) {
      this.selectedCountryId.set(item.countryId);
    } else if (item.regionId != null) {
      const region = this.allRegions().find(r => r.id === item.regionId);
      if (region?.countryId != null) this.selectedCountryId.set(region.countryId);
    }
    if (item.regionId != null) this.selectedRegionId.set(item.regionId);
    if (item.latitude != null && item.longitude != null) {
      this.setCoords(item.latitude, item.longitude);
    }
    this.clearPlaceOnly();
    this.cdr.detectChanges();
  }

  protected clearDestination(): void {
    this.form.update(f => ({ ...f, destinationId: null, placeId: null }));
    this.selectedDestName.set('');
    this.destinationQuery.set('');
    this.destinationResults.set([]);
    this.showDestResults.set(false);
    this.clearPlaceOnly();
  }

  protected hideDestResults(): void {
    setTimeout(() => { this.showDestResults.set(false); this.cdr.detectChanges(); }, 150);
  }

  private filterOwnerPlaces(nameQuery: string): PlaceSearchItem[] {
    const destId = this.form().destinationId ?? null;
    return this.ownerPlaces().filter(p => {
      if (destId && p.destinationId && p.destinationId !== destId) return false;
      if (nameQuery && !p.name.toLowerCase().includes(nameQuery.toLowerCase().trim())) return false;
      return true;
    });
  }

  // Place typeahead
  protected onPlaceFocus(): void {
    if (this.requiresOwnerDocuments && !this.placeQuery().trim()) {
      // Show own places as quick suggestions when field is empty
      const results = this.filterOwnerPlaces('');
      this.placeResults.set(results);
      this.showPlaceResults.set(results.length > 0);
      this.cdr.detectChanges();
      return;
    }
    this.showPlaceResults.set(this.placeResults().length > 0);
  }

  protected onPlaceInput(query: string): void {
    this.placeQuery.set(query);
    if (!query.trim()) { this.clearPlaceOnly(); return; }
    this.placeSearch$.next(query);
  }

  protected selectPlace(item: PlaceSearchItem): void {
    this.form.update(f => ({ ...f, placeId: item.id }));
    this.selectedPlaceName.set(item.name);
    this.placeQuery.set(item.name);
    this.placeResults.set([]);
    this.showPlaceResults.set(false);
    this.cdr.detectChanges();

    // Fetch full place detail to get coords, destinationId + countryId, then chain destination for regionId
    this.sub.add(
      this.eventsService.getPlaceById(item.id).subscribe({
        next: place => {
          if (!place) { this.cdr.detectChanges(); return; }
          if (place.latitude != null && place.longitude != null) {
            this.setCoords(place.latitude, place.longitude);
          }
          if (place.destinationId) {
            this.form.update(f => ({ ...f, destinationId: place.destinationId! }));
            this.selectedDestName.set(place.destinationName ?? '');
            this.destinationQuery.set(place.destinationName ?? '');
            this.sub.add(
              this.eventsService.getDestinationById(place.destinationId).subscribe({
                next: dest => {
                  if (dest?.regionId != null) this.selectedRegionId.set(dest.regionId);
                  const cid = dest?.countryId ?? place.countryId;
                  if (cid != null) {
                    this.selectedCountryId.set(cid);
                  } else if (dest?.regionId != null) {
                    const r = this.allRegions().find(reg => reg.id === dest.regionId);
                    if (r?.countryId != null) this.selectedCountryId.set(r.countryId);
                  }
                  if (place.latitude == null && dest?.latitude != null && dest.longitude != null) {
                    this.setCoords(dest.latitude, dest.longitude);
                  }
                  this.cdr.detectChanges();
                },
                error: () => {
                  if (place.countryId != null) this.selectedCountryId.set(place.countryId);
                  this.cdr.detectChanges();
                },
              }),
            );
          } else {
            if (place.countryId != null) this.selectedCountryId.set(place.countryId);
            this.cdr.detectChanges();
          }
        },
        error: () => {},
      }),
    );
  }

  protected clearPlaceOnly(): void {
    this.form.update(f => ({ ...f, placeId: null }));
    this.selectedPlaceName.set('');
    this.placeQuery.set('');
    this.placeResults.set([]);
    this.showPlaceResults.set(false);
  }

  protected hidePlaceResults(): void {
    setTimeout(() => { this.showPlaceResults.set(false); this.cdr.detectChanges(); }, 150);
  }

  // Interests
  protected toggleInterest(id: number): void {
    const cur = this.selectedInterestIds();
    this.selectedInterestIds.set(cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id]);
  }

  // Geocode
  protected geocode(): void {
    const address = this.form().address.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.http.get<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'sr-Latn,en' } },
    ).subscribe({
      next: r => { this.isGeocoding.set(false); if (r.length) this.setCoords(parseFloat(r[0].lat), parseFloat(r[0].lon), true); this.cdr.detectChanges(); },
      error: () => { this.isGeocoding.set(false); this.cdr.detectChanges(); },
    });
  }

  // Add new event type
  protected toggleAddType(): void {
    this.showAddType.update(v => !v);
    this.newTypeName.set('');
  }

  protected addNewType(): void {
    const name = this.newTypeName().trim();
    if (!name || this.isAddingType()) return;
    this.isAddingType.set(true);
    this.sub.add(
      this.eventsService.createEventType(name).subscribe({
        next: opt => {
          this.extraTypes.update(t => [...t, opt]);
          this.form.update(f => ({ ...f, typeId: opt.value, extraFilters: {} }));
          this.loadFilterDefs(opt.value);
          this.isAddingType.set(false);
          this.showAddType.set(false);
          this.newTypeName.set('');
          this.cdr.detectChanges();
        },
        error: () => {
          this.errors.set(['Kreiranje novog tipa nije uspelo.']);
          this.isAddingType.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  // Add new filter definition
  protected toggleAddFilter(): void {
    this.showAddFilter.update(v => !v);
    this.newFilterLabel.set('');
    this.newFilterType.set('boolean');
  }

  protected clearFilterValue(key: string): void {
    this.form.update(f => {
      const ef = { ...f.extraFilters };
      delete ef[key];
      return { ...f, extraFilters: ef };
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
    const def = this.filterDefs().find(d => d.id === id);
    if (!def) return;
    this.deletingFilterId.set(id);
    this.sub.add(
      this.eventsService.deleteFilterDefinition(id).subscribe({
        next: () => {
          this.filterDefs.update(d => d.filter(x => x.id !== id));
          const ef = { ...this.form().extraFilters };
          delete ef[def.filterKey];
          this.form.update(f => ({ ...f, extraFilters: ef }));
          this.deletingFilterId.set(null);
          this.cdr.detectChanges();
        },
        error: () => { this.deletingFilterId.set(null); this.cdr.detectChanges(); },
      }),
    );
  }

  protected addNewFilter(): void {
    const typeId = this.form().typeId;
    const label = this.newFilterLabel().trim();
    const type = this.newFilterType();
    if (!typeId || !label || this.isAddingFilter()) return;
    this.isAddingFilter.set(true);
    this.sub.add(
      this.eventsService.createFilterDefinition(typeId, label, type).subscribe({
        next: def => {
          this.filterDefs.update(d => [...d, def]);
          if (def.filterType === 'boolean') {
            this.form.update(f => ({
              ...f,
              extraFilters: { ...f.extraFilters, [def.filterKey]: 'true' },
            }));
          }
          this.isAddingFilter.set(false);
          this.showAddFilter.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.errors.set(['Kreiranje filtera nije uspelo.']);
          this.isAddingFilter.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected submit(): void {
    if (this.isSaving() || this.isCreated() || this.locationOutsideRegion()) return;

    const f = this.form();
    const errs: string[] = [];
    const name = f.name.trim();
    if (!name) errs.push('Naziv događaja je obavezan.');
    if (f.typeId === null) errs.push('Tip događaja je obavezan.');
    if (!f.startDatetime) errs.push('Datum i vreme početka su obavezni.');
    if (!f.endDatetime) errs.push('Datum i vreme završetka su obavezni.');
    const startDate = f.startDatetime ? new Date(f.startDatetime) : null;
    const endDate = f.endDatetime ? new Date(f.endDatetime) : null;
    if (startDate && isNaN(startDate.getTime())) errs.push('Datum početka nije validan.');
    if (endDate && isNaN(endDate.getTime())) errs.push('Datum završetka nije validan.');
    if (startDate && endDate && endDate < startDate) errs.push('Datum završetka mora biti posle datuma početka.');
    const fek = this.freeEntryKey();
    const isFreeEntry = fek !== null && f.extraFilters[fek] === 'true';
    const price = isFreeEntry ? null : (f.price.trim() ? Number(f.price.trim().replace(',', '.')) : null);
    if (price !== null && (isNaN(price) || price < 0)) errs.push('Cena mora biti pozitivan broj.');
    if (!f.description.trim()) errs.push('Opis događaja je obavezan.');
    if (this.selectedCountryId() === null) errs.push('Država je obavezna.');
    if (this.selectedRegionId() === null) errs.push('Regija je obavezna.');
    if (!f.destinationId) errs.push('Destinacija je obavezna.');
    if (!f.placeId && this.mapLatitude() === null) errs.push('Lokacija je obavezna — klikni na mapu ili pretraži adresu.');
    if (this.pendingImages().length === 0) errs.push('Dodaj barem 1 sliku pre kreiranja.');
    if (this.selectedInterestIds().length === 0) errs.push('Izaberi barem 1 interesovanje.');
    if (this.requiresOwnerDocuments && !f.placeId) {
      errs.push('Izaberite svoj objekat za koji vezujete dogadjaj.');
    }
    if (this.requiresOwnerDocuments && !this.hasRequiredOwnerDocuments()) {
      errs.push('Dodaj licni dokument i dokaz vlasnistva ili ovlascenja.');
    }
    if (errs.length) { this.errors.set(errs); return; }

    const payload: CreateEventPayload = {
      name,
      slug: this.toSlug(name),
      description: f.description.trim() || null,
      typeId: f.typeId!,
      startDatetime: startDate!.toISOString(),
      endDatetime: endDate!.toISOString(),
      price,
      address: f.address.trim() || null,
      cityId: null,
      countryId: null,
      destinationId: f.destinationId,
      placeId: f.placeId,
      latitude: this.mapLatitude(),
      longitude: this.mapLongitude(),
      ticketUrl: f.ticketUrl.trim() || null,
      isFeatured: f.isFeatured,
      recursAnnually: f.recursAnnually,
      extraFilters: Object.keys(f.extraFilters).length ? f.extraFilters : undefined,
    };

    this.isSaving.set(true);
    this.errors.set([]);
    this.sub.add(
      this.eventsService.createEvent(payload).subscribe({
        next: row => {
          const finishCreate = () => {
            this.uploadPendingDocuments(
              row.id,
              () => {
                this.uploadPendingImages(row.id, () => {
                  this.isSaving.set(false);
                  this.created.emit(row);
                  this.cdr.detectChanges();
                });
              },
              () => {
                this.isSaving.set(false);
                this.createdRow.set(row);
                this.errors.set(['Dogadjaj je kreiran, ali otpremanje dokumenta nije uspelo.']);
                this.cdr.detectChanges();
              },
            );
          };
          const ids = this.selectedInterestIds();
          if (ids.length > 0) {
            this.eventsService.setEventInterests(row.id, ids).subscribe({ next: finishCreate, error: finishCreate });
          } else {
            finishCreate();
          }
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.errors.set([this.createErrorMessage(error)]);
        },
      }),
    );
  }

  protected finish(): void { this.created.emit(this.createdRow()!); }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawFiles = Array.from(input.files ?? []);
    input.value = '';
    const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (files.length < rawFiles.length) { this.errors.set(['Slike moraju biti manje od 5 MB.']); }
    if (!files.length) { this.cdr.detectChanges(); return; }

    const eventId = this.createdRow()?.id;
    if (!eventId) {
      const pending = this.pendingImages();
      const slots = MAX_IMAGES - pending.length;
      if (slots <= 0) { this.errors.set([`Maksimalan broj slika je ${MAX_IMAGES}.`]); this.cdr.detectChanges(); return; }
      const toAdd = files.slice(0, slots).map(file => ({ file, url: URL.createObjectURL(file) }));
      this.pendingImages.update(p => [...p, ...toAdd]);
      this.cdr.detectChanges();
      return;
    }

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) { this.errors.set([`Maksimalan broj slika je ${MAX_IMAGES}.`]); this.cdr.detectChanges(); return; }
    const toUpload = files.slice(0, slots);
    this.uploadingCount.update(n => n + toUpload.length);
    toUpload.forEach(file => {
      this.sub.add(
        this.eventsService.uploadEventImage(eventId, file).subscribe({
          next: img => {
            this.images.update(l => [...l, img]);
            this.uploadingCount.update(n => n - 1);
            if (this.heroImageId() === null) this.setHero(img.id);
            this.cdr.detectChanges();
          },
          error: () => { this.uploadingCount.update(n => n - 1); this.errors.set(['Greška pri otpremanju slike.']); this.cdr.detectChanges(); },
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

  protected setHero(imageId: string): void {
    const eventId = this.createdRow()?.id;
    if (!eventId || this.isSettingHero()) return;
    this.isSettingHero.set(true);
    this.sub.add(
      this.eventsService.setHeroEventImage(eventId, imageId).subscribe({
        next: () => { this.heroImageId.set(imageId); this.isSettingHero.set(false); this.cdr.detectChanges(); },
        error: () => { this.isSettingHero.set(false); this.cdr.detectChanges(); },
      }),
    );
  }

  protected removeImage(imageId: string): void {
    const eventId = this.createdRow()?.id;
    if (!eventId) return;
    this.sub.add(
      this.eventsService.deleteEventImage(eventId, imageId).subscribe({
        next: () => {
          this.images.update(l => l.filter(i => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            this.heroImageId.set(null);
            const rem = this.images();
            if (rem.length > 0) this.setHero(rem[0].id);
          }
          this.cdr.detectChanges();
        },
        error: () => { this.errors.set(['Greška pri brisanju slike.']); this.cdr.detectChanges(); },
      }),
    );
  }

  private uploadPendingImages(eventId: string, onComplete?: () => void): void {
    const pending  = this.pendingImages();
    if (!pending.length) { onComplete?.(); return; }
    const heroIdx  = this.pendingHeroIndex();
    this.pendingImages.set([]);
    this.pendingHeroIndex.set(0);
    this.uploadingCount.update(n => n + pending.length);
    let settled = 0;
    const checkDone = () => { if (++settled === pending.length) onComplete?.(); };
    pending.forEach(({ file, url }, i) => {
      URL.revokeObjectURL(url);
      this.sub.add(
        this.eventsService.uploadEventImage(eventId, file).subscribe({
          next: img => {
            this.images.update(l => [...l, img]);
            this.uploadingCount.update(n => n - 1);
            if (i === heroIdx) this.setHero(img.id);
            else if (this.heroImageId() === null) this.setHero(img.id);
            checkDone();
            this.cdr.detectChanges();
          },
          error: () => {
            this.uploadingCount.update(n => n - 1);
            this.errors.set(['Greška pri otpremanju slike.']);
            checkDone();
            this.cdr.detectChanges();
          },
        }),
      );
    });
  }

  protected onOwnerDocumentSelected(type: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.errors.set(['Dokument mora biti manji od 10 MB.']);
      this.cdr.detectChanges();
      return;
    }
    this.ownerDocuments.update(current => ({ ...current, [type]: file }));
    this.cdr.detectChanges();
  }

  protected ownerDocumentName(type: string): string {
    return this.ownerDocuments()[type]?.name ?? '';
  }

  private uploadPendingDocuments(eventId: string, onDone: () => void, onError: () => void): void {
    const documents = this.ownerDocumentEntries();
    if (!documents.length) {
      onDone();
      return;
    }

    let done = 0;
    documents.forEach(([type, file]) => {
      this.sub.add(
        this.eventsService.uploadEventDocument(eventId, type, file).subscribe({
          next: () => {
            done++;
            if (done === documents.length) onDone();
          },
          error: onError,
        }),
      );
    });
  }

  private hasRequiredOwnerDocuments(): boolean {
    const documents = this.ownerDocuments();
    return !!documents['identity'] && !!documents['authorization'];
  }

  private createErrorMessage(error: HttpErrorResponse): string {
    const serverMessage = typeof error.error?.message === 'string' ? error.error.message : '';
    if (serverMessage.includes('Destination is required')) {
      return 'Izaberite destinaciju ili svoj objekat za koji vezujete dogadjaj.';
    }
    if (serverMessage.includes('attach events only to their own places')) {
      return 'Dogadjaj mozete povezati samo sa svojim objektom.';
    }
    return serverMessage || 'Kreiranje nije uspelo. Proverite podatke i pokusajte ponovo.';
  }

  private ownerDocumentEntries(): Array<[string, File]> {
    if (!this.requiresOwnerDocuments) return [];

    return Object.entries(this.ownerDocuments())
      .filter((entry): entry is [string, File] => entry[1] instanceof File);
  }

  private loadFilterDefs(typeId: number): void {
    this.sub.add(
      this.lookupService.getFilterDefinitions('event', typeId).subscribe({
        next: defs => {
          if (defs.some(d => d.filterKey === 'free_entry' || d.filterLabel.toLowerCase().includes('besplat'))) {
            this.filterDefs.set(defs);
            this.cdr.detectChanges();
          } else {
            this.sub.add(
              this.eventsService.createFilterDefinition(typeId, 'Besplatan ulaz', 'boolean').subscribe({
                next: def => { this.filterDefs.set([def, ...defs]); this.cdr.detectChanges(); },
                error: () => { this.filterDefs.set(defs); this.cdr.detectChanges(); },
              }),
            );
          }
        },
        error: () => this.filterDefs.set([]),
      }),
    );
  }

  private async initMap(): Promise<void> {
    if (!this.mapEl?.nativeElement) return;
    const base = patchStyleSources(await (await fetch(MAP_STYLE_URL)).json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle = this.buildThemedStyle(base, DARK);
    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [20.9, 44.0], zoom: 6, attributionControl: false,
    });
    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    this.map.on('click', e => { this.setCoords(e.lngLat.lat, e.lngLat.lng, true); this.cdr.detectChanges(); });
    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private setCoords(lat: number, lng: number, reverseGeocode = false): void {
    this.mapLatitude.set(lat);
    this.mapLongitude.set(lng);
    if (this.regionBoundary) {
      this.locationOutsideRegion.set(!isPointInGeoJsonGeometry(lat, lng, this.regionBoundary));
      this.cdr.detectChanges();
    }
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true }).setLngLat([lng, lat]).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.setCoords(pos.lat, pos.lng, true);
        this.cdr.detectChanges();
      });
    }
    this.map.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
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
            this.form.update(f => ({ ...f, address: shortAddr }));
            this.cdr.detectChanges();
            if (city) {
              this.eventsService.searchDestinations(city).subscribe({
                next: results => {
                  if (!results.length) return;
                  const dest = results[0];
                  this.form.update(f => ({ ...f, destinationId: dest.id, placeId: null }));
                  this.selectedDestName.set(dest.name);
                  this.destinationQuery.set(dest.name);
                  if (dest.countryId != null) this.selectedCountryId.set(dest.countryId);
                  if (dest.regionId != null) this.selectedRegionId.set(dest.regionId);
                  this.cdr.detectChanges();
                },
              });
            }
          }
        },
      });
      if (this.lockedRegionId === null) {
        this.http.get<{ regionId: number | null; countryId: number | null }>(
          `/api/region-by-coords?lat=${lat}&lng=${lng}`,
        ).subscribe({
          next: res => {
            if (res.countryId) this.selectedCountryId.set(res.countryId);
            if (res.regionId) this.selectedRegionId.set(res.regionId);
            this.cdr.detectChanges();
          },
        });
      }
    }
  }

  private destroyMap(): void {
    this.themeObserver?.disconnect();
    this.map?.remove();
    this.map = null; this.marker = null;
  }

  private emptyForm(): EventForm {
    return {
      name: '',
      description: '',
      typeId: null,
      startDatetime: '',
      endDatetime: '',
      price: '',
      address: '',
      destinationId: null,
      placeId: null,
      ticketUrl: '',
      isFeatured: false,
      recursAnnually: false,
      extraFilters: {}
    };
  }

  private toSlug(name: string): string {
    return `${name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'event'}-${Date.now().toString(36)}`;
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1,3),16)*0.299 + parseInt(hex.slice(3,5),16)*0.587 + parseInt(hex.slice(5,7),16)*0.114;
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
